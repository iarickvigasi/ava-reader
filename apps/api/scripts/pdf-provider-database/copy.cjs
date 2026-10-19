'use strict';
// Actual import coordinator/transactions with an authored admission inspection.
// No HTTP, real inspector, worker, provider, or reader execution is claimed.
module.exports = async function checkCopies(db, s, verify) {
  const { assert, load, req } = s;
  const { isDeepStrictEqual } = require('node:util');
  const fs = require('node:fs'),
    path = require('node:path');
  const bytes = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../../packages/pdf-epub/tests/reconstruction_v2/fixtures/native.pdf',
    ),
  );
  const inspectionModule = load('library/pdf-import/admission/inspect-pdf');
  const realInspection = inspectionModule.inspectPdf;
  let inspections = 0;
  inspectionModule.inspectPdf = async (actual, sourceSha256) => {
    assert.deepEqual(actual, bytes);
    assert.equal(sourceSha256, s.sourceSha);
    inspections++;
    return {
      source_sha256: s.sourceSha,
      page_count: 8,
      metadata: {},
      pages: Array.from({ length: 8 }, () => ({ width: 595, height: 842 })),
    };
  };
  const priorMode = process.env.AVA_PDF_TEST_PROVIDER_MODE;
  delete process.env.AVA_PDF_TEST_PROVIDER_MODE;
  try {
    const owner = await db.user.create({
      data: {
        clerkUserId: 'copy-ci-owner',
        primaryEmail: 'copy@fixture.invalid',
      },
    });
    const other = await db.user.create({
      data: {
        clerkUserId: 'copy-ci-other',
        primaryEmail: 'other-copy@fixture.invalid',
      },
    });
    const importPdf = load('library/pdf-import/import-pdf').importPdf;
    const send = (key, copyOfOperationId, userId = owner.id, buffer = bytes) =>
      importPdf({
        prisma: db,
        userId,
        idempotencyKey: key,
        convertToEpub: true,
        copyOfOperationId,
        file: { buffer, size: buffer.length, originalname: 'Copy fixture.pdf' },
      });
    const first = await send('copy-ci-original-0001');
    await db.readingProgress.update({
      where: { libraryItemId: first.libraryItemId },
      data: {
        completionPercent: 37,
        currentLocator: 'authored-preservation-position',
        minutesRead: 12,
      },
    });
    await db.annotation.create({
      data: {
        userId: owner.id,
        libraryItemId: first.libraryItemId,
        excerpt: 'Authored preservation witness',
        note: 'Keep this private note',
        highlightColor: 'sky',
      },
    });
    const baseline = {};
    for (const model of req('@prisma/client').Prisma.dmmf.datamodel.models) {
      const name = model.name[0].toLowerCase() + model.name.slice(1);
      baseline[name] = await db[name].findMany();
    }
    const beforeInspect = inspections;
    await assert.rejects(
      send('copy-ci-unconfirmed-0001'),
      (e) =>
        e.getStatus() === 409 &&
        e.getResponse().code === 'PDF_ALREADY_IMPORTED',
    );
    verify(
      'exact source requires an explicit copy choice before inspection',
      inspections === beforeInspect,
    );
    const copyKey = 'copy-ci-confirmed-0001';
    const [a, b] = await Promise.all([
      send(copyKey, first.operationId),
      send(copyKey, first.operationId),
    ]);
    verify(
      'simultaneous explicit confirmations create one independent copy',
      a.operationId === b.operationId &&
        a.libraryItemId === b.libraryItemId &&
        a.operationId !== first.operationId &&
        a.libraryItemId !== first.libraryItemId,
    );
    const original = await db.pdfImportOperation.findUniqueOrThrow({
        where: { id: first.operationId },
      }),
      copy = await db.pdfImportOperation.findUniqueOrThrow({
        where: { id: a.operationId },
      });
    verify(
      'copy has independent book source job and zero reading progress',
      copy.bookId !== original.bookId &&
        copy.sourceArtifactId !== original.sourceArtifactId &&
        (await db.pdfConversionJob.count({
          where: { operationId: copy.id },
        })) === 1 &&
        (
          await db.readingProgress.findUniqueOrThrow({
            where: { libraryItemId: copy.libraryItemId },
          })
        ).completionPercent === 0 &&
        (await db.annotation.count({
          where: { libraryItemId: copy.libraryItemId },
        })) === 0,
    );
    const counts = await db.pdfImportOperation.count();
    await assert.rejects(
      send(copyKey, copy.id),
      (e) =>
        e.getStatus() === 409 &&
        e.getResponse().code === 'IMPORT_REQUEST_CONFLICT',
    );
    for (const [userId, reference, buffer] of [
      [other.id, first.operationId, bytes],
      [owner.id, 'nonexistent-copy-source', bytes],
      [
        owner.id,
        first.operationId,
        Buffer.concat([bytes, Buffer.from('\n%other source')]),
      ],
    ])
      await assert.rejects(
        send(
          'copy-ci-denied-' + userId + '-' + reference + '-' + buffer.length,
          reference,
          userId,
          buffer,
        ),
        (e) =>
          e.getStatus() === 409 &&
          e.getResponse().code === 'PDF_COPY_SOURCE_UNAVAILABLE',
      );
    verify(
      'changed intent and foreign missing or mismatched source create no operation',
      (await db.pdfImportOperation.count()) === counts,
    );
    // Preserve every baseline value; stock default-shelf updates may refresh only their timestamps.
    const refreshedShelves = [];
    for (const [name, rows] of Object.entries(baseline)) {
      const current = await db[name].findMany();
      for (const row of rows) {
        if (current.some((value) => isDeepStrictEqual(value, row))) continue;
        const value = current.find((value) => value.id === row.id);
        const changedFields = value
          ? Object.keys(row).filter(
              (key) => !isDeepStrictEqual(row[key], value[key]),
            )
          : ['ROW_MISSING'];
        console.log(
          JSON.stringify({
            kind: 'COPY_BASELINE_DIFFERENCE',
            model: name,
            changedFields,
          }),
        );
        // Existing stock shelf upsert refreshes @updatedAt, not reader content.
        assert.equal(name, 'collection');
        assert.equal(row.userId, owner.id);
        assert.equal(row.kind, 'SMART');
        assert.ok(
          [
            'imported-library',
            'public-domain-library',
            'offline-books',
          ].includes(row.smartKey),
        );
        refreshedShelves.push(row.smartKey);
        assert.deepEqual(changedFields, ['updatedAt']);
        assert.ok(
          value.updatedAt instanceof Date && value.updatedAt >= row.updatedAt,
        );
      }
    }
    assert.deepEqual(refreshedShelves.sort(), [
      'imported-library',
      'offline-books',
      'public-domain-library',
    ]);
    verify(
      'all pre-copy values marks and progress stay exact except owner smart-shelf update timestamps',
      true,
    );
    await db.pdfImportOperation.update({
      where: { id: first.operationId },
      data: { deletedAt: new Date() },
    });
    await assert.rejects(send('copy-ci-surviving-0001'), (e) => {
      const body = e.getResponse();
      return (
        e.getStatus() === 409 &&
        body.code === 'PDF_ALREADY_IMPORTED' &&
        body.operationId === copy.id &&
        body.libraryItemId === copy.libraryItemId
      );
    });
    verify(
      'fresh selection finds surviving live copy after original removal',
      true,
    );
    const replay = await send(copyKey, first.operationId);
    verify(
      'accepted copy replay survives removal of original source entry',
      replay.operationId === copy.id &&
        replay.libraryItemId === copy.libraryItemId,
    );
    await assert.rejects(
      send('copy-ci-removed-0001', first.operationId),
      (e) =>
        e.getStatus() === 409 &&
        e.getResponse().code === 'PDF_COPY_SOURCE_UNAVAILABLE',
    );
    verify(
      'removed source cannot authorize another copy',
      (await db.pdfImportOperation.count()) === counts,
    );
    verify(
      'all copy jobs stay queued native with no dispatch grant',
      (await db.pdfConversionJob.count({
        where: {
          operationId: { in: [original.id, copy.id] },
          state: 'QUEUED',
          providerMode: 'native',
          dispatchAuthorizationId: null,
        },
      })) === 2,
    );
  } finally {
    inspectionModule.inspectPdf = realInspection;
    if (priorMode === undefined) delete process.env.AVA_PDF_TEST_PROVIDER_MODE;
    else process.env.AVA_PDF_TEST_PROVIDER_MODE = priorMode;
  }
};
