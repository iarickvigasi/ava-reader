const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

const ENTITY_REFERENCE_PATTERN =
  /&(?:#([0-9]+)|#[xX]([0-9a-fA-F]+)|([A-Za-z_:][\w:.-]*));/g;

export function createXmlEntityDecoder(): EntityDecoderOptions {
  let externalEntities: Record<string, string> = {};
  let inputEntities: Record<string, string> = {};

  return {
    addInputEntities(entities: Record<string, string>) {
      inputEntities = { ...inputEntities, ...entities };
    },
    decode(value: string) {
      return decodeXmlEntities(value, {
        ...externalEntities,
        ...inputEntities,
      });
    },
    reset() {
      inputEntities = {};
    },
    setExternalEntities(entities: Record<string, string>) {
      externalEntities = { ...entities };
    },
    setXmlVersion() {},
  };
}

export function decodeXmlEntities(
  value: string,
  additionalEntities: Record<string, string> = {},
) {
  return value.replace(
    ENTITY_REFERENCE_PATTERN,
    (
      reference: string,
      decimal: string | undefined,
      hexadecimal: string | undefined,
      name: string | undefined,
    ) => {
      if (decimal) {
        return decodeNumericReference(reference, decimal, 10);
      }
      if (hexadecimal) {
        return decodeNumericReference(reference, hexadecimal, 16);
      }
      return name
        ? (additionalEntities[name] ?? XML_ENTITIES[name] ?? reference)
        : reference;
    },
  );
}

function decodeNumericReference(
  reference: string,
  digits: string,
  radix: number,
) {
  const codePoint = Number.parseInt(digits, radix);
  return isValidXmlCodePoint(codePoint)
    ? String.fromCodePoint(codePoint)
    : reference;
}

function isValidXmlCodePoint(codePoint: number) {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  );
}
import type { EntityDecoderOptions } from 'fast-xml-parser';
