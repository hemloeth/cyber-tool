"""
Parses complete OWASP Knowledge Base (CheatSheets, Web Security Testing Guide WSTG, and API Security Top 10) into RAG-ready chunks.
Sources:
- https://github.com/OWASP/CheatSheetSeries
- https://github.com/OWASP/wstg
- https://github.com/OWASP/API-Security
"""
import json
import re
import subprocess
from pathlib import Path

KNOWLEDGE_DIR = Path("knowledge/OWASP")
OUTPUT_FILE = Path("processed/owasp_chunks.jsonl")

REPOSITORIES = [
    {
        "name": "CheatSheetSeries",
        "url": "https://github.com/OWASP/CheatSheetSeries.git",
        "dir": KNOWLEDGE_DIR / "CheatSheetSeries",
        "doc_type": "cheatsheet"
    },
    {
        "name": "WSTG",
        "url": "https://github.com/OWASP/wstg.git",
        "dir": KNOWLEDGE_DIR / "wstg",
        "doc_type": "wstg_test_guide"
    },
    {
        "name": "API-Security",
        "url": "https://github.com/OWASP/API-Security.git",
        "dir": KNOWLEDGE_DIR / "API-Security",
        "doc_type": "api_security"
    }
]


def ensure_repository(repo_info: dict):
    """Clone repository if not present locally."""
    target_dir = repo_info["dir"]
    if not target_dir.exists():
        print(f"[OWASP Parser] Directory '{target_dir}' not found.")
        print(f"[OWASP Parser] Cloning {repo_info['name']} from {repo_info['url']}...")
        target_dir.parent.mkdir(parents=True, exist_ok=True)
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", repo_info["url"], str(target_dir)],
                check=True
            )
            print(f"[OWASP Parser] {repo_info['name']} cloned successfully.")
        except Exception as e:
            print(f"[OWASP Parser] Error cloning {repo_info['name']}: {e}")


def chunk_markdown(text: str, source: str, document_type: str, max_chars: int = 1500) -> list[dict]:
    """Split markdown by headers, then further split any section that's too long."""
    sections = re.split(r"\n(?=#{1,3} )", text)
    chunks = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        if len(section) <= max_chars:
            chunks.append(section)
        else:
            paragraphs = section.split("\n\n")
            current = ""
            for p in paragraphs:
                if len(current) + len(p) > max_chars and current:
                    chunks.append(current.strip())
                    current = p
                else:
                    current += "\n\n" + p
            if current.strip():
                chunks.append(current.strip())

    return [
        {
            "source": source,
            "framework": "OWASP",
            "category": "Security",
            "document_type": document_type,
            "text": c
        }
        for c in chunks
        if len(c) > 50  # skip near-empty fragments
    ]


def parse_cheatsheet_series(repo_dir: Path) -> list[dict]:
    """Parse CheatSheetSeries markdown files."""
    chunks = []
    
    # 1. Main Cheatsheets
    main_dir = repo_dir / "cheatsheets"
    if main_dir.exists():
        for md_file in main_dir.glob("*.md"):
            text = md_file.read_text(encoding="utf-8", errors="ignore")
            chunks.extend(chunk_markdown(text, source=md_file.stem, document_type="cheatsheet"))

    # 2. Draft Cheatsheets
    draft_dir = repo_dir / "cheatsheets_draft"
    if draft_dir.exists():
        for md_file in draft_dir.glob("*.md"):
            text = md_file.read_text(encoding="utf-8", errors="ignore")
            chunks.extend(chunk_markdown(text, source=f"draft_{md_file.stem}", document_type="cheatsheet_draft"))

    # 3. Security Indices
    for md_file in repo_dir.glob("Index*.md"):
        text = md_file.read_text(encoding="utf-8", errors="ignore")
        chunks.extend(chunk_markdown(text, source=md_file.stem, document_type="index_mapping"))

    return chunks


def parse_wstg(repo_dir: Path) -> list[dict]:
    """Parse Web Security Testing Guide (WSTG) markdown files."""
    chunks = []
    # WSTG chapters reside in document/ directory
    docs_dir = repo_dir / "document"
    if not docs_dir.exists():
        docs_dir = repo_dir

    for md_file in docs_dir.rglob("*.md"):
        if any(ignored in md_file.name for ignored in ["README.md", "SUMMARY.md", "CONTRIBUTING.md"]):
            continue
        text = md_file.read_text(encoding="utf-8", errors="ignore")
        chunks.extend(chunk_markdown(text, source=f"WSTG_{md_file.stem}", document_type="wstg_testing_guide"))

    return chunks


def parse_api_security(repo_dir: Path) -> list[dict]:
    """Parse API Security Top 10 markdown files."""
    chunks = []
    for md_file in repo_dir.rglob("*.md"):
        if any(ignored in md_file.name for ignored in ["README.md", "CONTRIBUTING.md"]):
            continue
        text = md_file.read_text(encoding="utf-8", errors="ignore")
        chunks.extend(chunk_markdown(text, source=f"API_Sec_{md_file.stem}", document_type="api_security_top10"))

    return chunks


def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    all_chunks = []

    for repo in REPOSITORIES:
        ensure_repository(repo)
        repo_dir = repo["dir"]
        
        if not repo_dir.exists():
            print(f"[OWASP Parser] Skipping {repo['name']} (directory not found).")
            continue

        print(f"[OWASP Parser] Processing {repo['name']}...")
        if repo["name"] == "CheatSheetSeries":
            chunks = parse_cheatsheet_series(repo_dir)
        elif repo["name"] == "WSTG":
            chunks = parse_wstg(repo_dir)
        elif repo["name"] == "API-Security":
            chunks = parse_api_security(repo_dir)
        else:
            chunks = []

        print(f"[OWASP Parser] Extracted {len(chunks)} chunks from {repo['name']}.")
        all_chunks.extend(chunks)

    # Write output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for chunk in all_chunks:
            f.write(json.dumps(chunk) + "\n")

    print(f"[OWASP Parser] Successfully wrote TOTAL {len(all_chunks)} OWASP chunks to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
