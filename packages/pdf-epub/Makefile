UV ?= uv
PYTHON ?= .venv/bin/python
OUT ?= output/smoke
EPUBCHECK_JAR ?=

.PHONY: sync check test lint typecheck build smoke inventory container

sync:
	$(UV) sync --locked --extra dev

check: test lint typecheck

test:
	$(PYTHON) -m unittest discover -s tests -t . -v

lint:
	$(PYTHON) -m ruff check src tests scripts

typecheck:
	$(PYTHON) -m mypy src/ava_pdf_epub

build:
	SOURCE_DATE_EPOCH=1790553600 $(UV) build --no-sources --python $(PYTHON)

smoke:
	$(PYTHON) scripts/smoke.py --out $(OUT) $(if $(EPUBCHECK_JAR),--epubcheck-jar $(EPUBCHECK_JAR),)

inventory:
	$(PYTHON) scripts/dependency_inventory.py --out $(OUT)/python-dependencies.json

container:
	docker build --tag ava-pdf-epub:pdf02 .
