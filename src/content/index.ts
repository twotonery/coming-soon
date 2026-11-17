// The site's editable content: project highlights, services ("What we shape")
// and testimonials ("What they say"). site.json is written from the content
// editor (a Claude artifact; see CMS.md at the repo root), so edit it there
// rather than by hand, or the next publish from the editor overwrites the change.
import site from "./site.json";

// A picture, or a clip that plays muted on a loop in its place.
export type Media = { kind: "image" | "video"; src: string };
export type Project = { id: string; title: string; tags: string; media: Media };
export type Service = { id: string; name: string; media: Media };
// `photo` is set on the photo cards only; `video` is an interview to watch: a
// file under /public, or a YouTube, Vimeo or direct video link.
export type Testimonial = { id: string; quote: string; name: string; role: string; photo: string | null; video: string | null };

export const PROJECTS = site.projects as Project[];
export const SERVICES = site.services as Service[];
export const TESTIMONIALS = site.testimonials as Testimonial[];
