# Receipt sample screenshots

Reference images used to train QR authenticity detection for each supported bank.

| File | Bank | Real QR format |
|------|------|----------------|
| `boa-receipt.png` | Bank of Abyssinia | Signed binary base64 payload (~112 bytes), NOT plain FT text |
| `cbe-success-card.png` | CBE | Official URL `https://mbreciept.cbe.com.et/v2-{token}` |
| `cbe-transaction-summary.png` | CBE | Same official Mbreciept verification URL |
| `dashen-vat-receipt.png` | Dashen Bank | Signed/official URL payload (not plain IPSS text) |
| `dashen-success-paid.png` | Dashen Bank | Signed QR on success screen |

## Fake QR patterns blocked

- Plain payment ID only (e.g. `FT26169X4SRS`, `110IPSS2616900WO`)
- Public QR generator URLs (qr-code-generator.com, goqr.me, etc.)
- Wrong bank domain on QR URL
- Random generic URLs not from the bank

Rules: `server/src/services/qrAuthenticityService.js`  
Extraction rules: `server/src/services/receiptFormats.js`
