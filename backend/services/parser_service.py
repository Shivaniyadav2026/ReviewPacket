from __future__ import annotations

from bs4 import BeautifulSoup


class ParserService:
    """Flexible HTML parser for Collaborator pages.

    It extracts generic key/value metadata from labeled table rows, dt/dd lists,
    and heading-based sections so field names can vary by template.
    """

    def parse_review_html(self, html: str) -> dict[str, str]:
        soup = BeautifulSoup(html, "html.parser")
        fields: dict[str, str] = {}

        title = self._extract_title(soup)
        if title:
            fields["Review Title"] = title

        fields.update(self._extract_table_fields(soup))
        fields.update(self._extract_definition_fields(soup))
        fields.update(self._extract_section_fields(soup))

        return {key: value.strip() for key, value in fields.items() if key.strip()}

    def _extract_title(self, soup: BeautifulSoup) -> str:
        for selector in ["h1", "title", "[data-review-title]"]:
            tag = soup.select_one(selector)
            if tag and tag.get_text(strip=True):
                return tag.get_text(" ", strip=True)
        return ""

    def _extract_table_fields(self, soup: BeautifulSoup) -> dict[str, str]:
        result: dict[str, str] = {}
        for row in soup.select("tr"):
            header = row.find(["th", "td"], recursive=False)
            if not header:
                continue
            cells = row.find_all(["td", "th"], recursive=False)
            if len(cells) < 2:
                continue

            key = header.get_text(" ", strip=True).rstrip(":")
            value = " ".join(cell.get_text(" ", strip=True) for cell in cells[1:]).strip()
            if key and value:
                result.setdefault(key, value)
        return result

    def _extract_definition_fields(self, soup: BeautifulSoup) -> dict[str, str]:
        result: dict[str, str] = {}
        for term in soup.select("dt"):
            key = term.get_text(" ", strip=True).rstrip(":")
            value_tag = term.find_next_sibling("dd")
            if not value_tag:
                continue
            value = value_tag.get_text(" ", strip=True)
            if key and value:
                result.setdefault(key, value)
        return result

    def _extract_section_fields(self, soup: BeautifulSoup) -> dict[str, str]:
        result: dict[str, str] = {}
        headings = soup.select("h2, h3, h4")
        for heading in headings:
            key = heading.get_text(" ", strip=True).rstrip(":")
            if not key:
                continue

            content_parts: list[str] = []
            for sibling in heading.find_next_siblings(limit=5):
                if sibling.name in {"h1", "h2", "h3", "h4"}:
                    break
                text = sibling.get_text(" ", strip=True)
                if text:
                    content_parts.append(text)

            value = " ".join(content_parts).strip()
            if value:
                result.setdefault(key, value)
        return result
