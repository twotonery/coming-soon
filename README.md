# Twotonery website

Next.js 16 (App Router) + Tailwind CSS 4. Headings in Epilogue, body in Geist.

```bash
npm install
npm run dev          # http://localhost:3000
```

The landing page is built from the Figma file **Code-layer**, frame "Landing page" (node `8:6`):
https://www.figma.com/design/PS5ZiITg3yJpg6KUf0ZzfM/Code-layer?node-id=8-6

## Where things live

- `src/app/page.tsx` — the page, one component per section
- `src/components/landing/` — Hero, About, Highlight (project highlight), Services, Pricing, Testimonials, Faq, Footer; `shared.tsx` holds the booking link, type styles and the hairline frame pieces
- `public/figma/` — every image and SVG exported from the Figma frame
- `src/app/globals.css` — colour tokens from the frame and the paper texture

Placeholders: the booking link (`hello@twotonery.com`), social links, Privacy / Terms, the "Watch interview" button, the testimonial name, the Growth price, and the FAQ answers other than the first.
