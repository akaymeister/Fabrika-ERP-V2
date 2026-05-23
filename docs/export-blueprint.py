#!/usr/bin/env python3
"""Export FactoryOS V3 Gate / Kabul Kriterleri to DOCX and PDF."""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
MD = os.path.join(ROOT, "FactoryOS-V3-Gate-Kabul-Kriterleri.md")
DOCX = os.path.join(ROOT, "FactoryOS-V3-Gate-Kabul-Kriterleri.docx")
PDF = os.path.join(ROOT, "FactoryOS-V3-Gate-Kabul-Kriterleri.pdf")


def main():
    if not os.path.isfile(MD):
        print(f"Missing: {MD}", file=sys.stderr)
        sys.exit(1)

    import pypandoc

    print("Converting to DOCX...")
    pypandoc.convert_file(
        MD,
        "docx",
        outputfile=DOCX,
        extra_args=["--standalone"],
    )
    print(f"DOCX: {DOCX}")

    print("Converting to PDF...")
    try:
        pypandoc.convert_file(
            MD,
            "pdf",
            outputfile=PDF,
            extra_args=["--standalone", "-V", "geometry:margin=2cm"],
        )
        print(f"PDF: {PDF}")
    except Exception as e:
        print(f"PDF via pandoc failed: {e}")
        try:
            from docx2pdf import convert

            convert(DOCX, PDF)
            print(f"PDF (via Word/docx2pdf): {PDF}")
        except Exception as e2:
            print(f"PDF fallback failed: {e2}")
            print("DOCX is available; open in Word and Save As PDF.")


if __name__ == "__main__":
    main()
