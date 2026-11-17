// The site's editable content: which sections show, the hero background, the
// pricing tickets' pictures, project highlights, services ("What we shape") and
// testimonials ("What they say") and the common questions. site.json is written from the content
// editor (a Claude artifact; see CMS.md at the repo root), so edit it there
// rather than by hand, or the next publish from the editor overwrites the change.
import site from "./site.json";

// A picture, or a clip that plays muted on a loop in its place.
export type Media = { kind: "image" | "video"; src: string };
export type Project = { id: string; title: string; tags: string; media: Media };
export type Service = { id: string; name: string; media: Media };
// `photo` is set on the photo cards only; `video` is an interview to watch: a
// file under /public, or a YouTube, Vimeo or direct video link.
// `media` off shows the card with its words only; `hidden` takes it off the page.
export type Testimonial = { id: string; quote: string; name: string; role: string; photo: string | null; video: string | null; media?: boolean; hidden?: boolean };
// The sections that can be switched off. The hero and the footer always show.
export type SectionKey = "about" | "founder" | "work" | "services" | "pricing" | "testimonials" | "faq";

// A section shows unless it is switched off.
export const SHOWN = (key: SectionKey) => (site.sections as Partial<Record<SectionKey, boolean>>)[key] !== false;
export const HERO = site.hero.media as Media;
// The picture inside each pricing ticket's stamp window.
// The founder stamp's portrait, and her quote: paragraphs split by an empty line.
export const FOUNDER = site.founder as { portrait: string; quote: string; name: string };
export const TICKET_PICTURES = site.pricing as { growth: string; dedicated: string };

export const PROJECTS = site.projects as Project[];
export const SERVICES = site.services as Service[];
export const TESTIMONIALS = site.testimonials as Testimonial[];
export type Question = { id: string; q: string; a: string };
export const FAQ = site.faq as Question[];
