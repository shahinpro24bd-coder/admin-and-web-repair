import { parse, serialize } from "parse5";

/** Final head metadata uses the translated page title and the current host. */
export function brandShareHead(html: string, origin: string): string {
  const doc = parse(html);
  const root = doc.childNodes.find((node) => node.nodeName === "html");
  if (!root || !("childNodes" in root)) return html;
  const head = root.childNodes.find((node) => node.nodeName === "head");
  if (!head || !("childNodes" in head)) return html;
  const titleNode = head.childNodes.find((node) => node.nodeName === "title");
  const title = titleNode && "childNodes" in titleNode
    ? titleNode.childNodes.map((node) => "value" in node ? node.value : "").join("")
    : "Dr. Lama Ghassan";
  const descriptionNode = head.childNodes.find((node) => "attrs" in node && node.attrs.some((attr) => attr.name === "name" && attr.value === "description"));
  const description = descriptionNode && "attrs" in descriptionNode
    ? descriptionNode.attrs.find((attr) => attr.name === "content")?.value ?? title
    : title;
  const image = new URL("/img/dr-lama-logo.png", origin).href;
  const tags: Record<string, string> = {
    "og:title": title,
    "og:description": description,
    "og:type": "website",
    "og:site_name": "Dr. Lama Ghassan",
    "twitter:card": "summary",
    ...(image.startsWith("https://") ? { "og:image": image, "twitter:image": image, "og:image:alt": "Dr. Lama Ghassan logo" } : {}),
  };
  head.childNodes = head.childNodes.filter((node) => !("attrs" in node && node.nodeName === "meta" && node.attrs.some((attr) => (attr.name === "property" || attr.name === "name") && attr.value in tags)));
  for (const node of head.childNodes) {
    if (node.nodeName !== "link" || !("attrs" in node)) continue;
    const rel = node.attrs.find((attr) => attr.name === "rel")?.value;
    if (rel !== "icon" && rel !== "apple-touch-icon") continue;
    const href = node.attrs.find((attr) => attr.name === "href");
    if (href) href.value = rel === "icon" ? "/favicon.png?v=drlama-2" : "/site-icon.png?v=drlama-2";
  }
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const metadata = Object.entries(tags).map(([key, value]) => `<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escape(value)}">`).join("");
  return serialize(doc).replace("</head>", `${metadata}</head>`);
}