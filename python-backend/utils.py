# utils.py
def parse_pdf_date(pdf_date):
    """Parse PDF date format (e.g., 'D:20210601232157') into ISO format."""
    if not pdf_date or not isinstance(pdf_date, str) or not pdf_date.startswith('D:'):
        return None
    try:
        date_str = pdf_date[2:16]
        return f"{date_str[0:4]}-{date_str[4:6]}-{date_str[6:8]}T{date_str[8:10]}:{date_str[10:12]}:{date_str[12:14]}"
    except Exception:
        return None