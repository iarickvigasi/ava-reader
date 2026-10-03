# Worker dependencies and license inventory

The complete version/hash lock is [uv.lock](uv.lock). [dependency-inventory.json](dependency-inventory.json)
records the inspected macOS development installation, with license metadata and supplied license-file
hashes. Run `make inventory` to inventory a new installed environment. It is separate from the
[container/native inputs](native-dependencies.json); the built image also records its actual Python
and Debian package inventories under `/usr/share/ava/`.

| Component                                              | Inspected license metadata                                     | Use                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Python 3.12.14                                         | PSF license and bundled third-party notices                    | Runtime, from the pinned official Python image                       |
| Pydantic 2.13.5, pydantic-core 2.46.5                  | MIT                                                            | Strict document and shared-contract validation                       |
| pypdf 6.19.0                                           | BSD-3-Clause                                                   | Bounded PDF inventory/objects                                        |
| Pillow 12.3.0                                          | MIT-CMU                                                        | Images and crops; wheel contains native libraries                    |
| pdfplumber 0.11.9, pdfminer.six 20251230               | MIT                                                            | Native PDF geometry/text                                             |
| pypdfium2 5.13.0                                       | BSD-3-Clause, Apache-2.0 and dependency licenses               | Transitive pdfplumber dependency; bundled PDFium has its own notices |
| cryptography 50.0.1                                    | Apache-2.0 OR BSD-3-Clause                                     | Transitive PDF dependency; native wheel components                   |
| cffi 2.1.1 / pycparser 3.0                             | MIT-0 / BSD-3-Clause                                           | Transitive native bindings                                           |
| annotated-types, charset-normalizer, typing-inspection | MIT                                                            | Transitive support libraries; exact versions in lock                 |
| typing-extensions 4.16.0                               | PSF-2.0                                                        | Transitive typing support                                            |
| uv 0.9.26                                              | MIT OR Apache-2.0                                              | Locked install/build tool; pinned image digest                       |
| setuptools 80.9.0, build 1.3.0, pyproject-hooks        | MIT plus bundled notices                                       | Pinned build tools; exact transitive versions in lock                |
| Ruff 0.16.9, mypy 1.20.2, mypy-extensions, librt       | MIT plus bundled notices                                       | Development checks only                                              |
| packaging 26.3 / pathspec 1.1.1                        | Apache-2.0 OR BSD-2-Clause / MPL-2.0                           | Development dependencies                                             |
| Poppler 22.12.0, Debian revision in native manifest    | Mixed GPL-2 / GPL-2-or-GPL-3 / GPL-3 / Apache-2.0 file notices | Separate `pdftoppm` executable; source/render tool                   |
| OpenJDK 17.0.20.1, Debian revision in native manifest  | GPL-2.0 with Classpath exception and dependency notices        | Optional EPUBCheck JVM                                               |
| EPUBCheck 5.4.0                                        | BSD-3-Clause plus bundled dependency notices                   | Optional mounted release, not copied into image                      |

This table is an engineering inventory, not permission to relicense third-party components. Keep
upstream notices/license files when distributing the image or dependencies; inspect the actual
native and wheel-bundled notices for the chosen platform. In particular, Poppler and bundled
PDFium/Java components are not accurately described by one Python-package license label.
No open-source license grant for AVA's own code is added by this work. No model weights, commercial
fonts, private source book or provider credential is part of the package or image.

The runtime inventory script reads only installed distribution metadata and supplied license files.
It does not make network calls. The lock's Windows-only development dependency is not represented
as installed on macOS; cross-platform qualification requires a run on the claimed platform.

Primary license sources: installed wheel license files (hashed in the inventory), Debian native
`/usr/share/doc/*/copyright`, [Python](https://docs.python.org/3.12/license.html),
[uv](https://github.com/astral-sh/uv/tree/0.9.26), and
[EPUBCheck](https://github.com/w3c/epubcheck/tree/v5.4.0). This inventory does not assert a complete
SBOM or vulnerability scan; bundled native components require their own distribution review.

The copied uv executable carries its version-matched MIT notice at
[licenses/uv-MIT.txt](licenses/uv-MIT.txt), copied into `/usr/share/doc/uv/copyright` in the image.
