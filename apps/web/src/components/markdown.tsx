import React from "react";

// Minimal, dependency-free markdown renderer for blog posts.
// Supports: # ## ### headings, - / * bullet lists, **bold**, *italic*, `code`, [text](url), paragraphs.
function inline(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  const re = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/;
  while (remaining) {
    const m = remaining.match(re);
    if (!m || m.index === undefined) { nodes.push(remaining); break; }
    if (m.index > 0) nodes.push(remaining.slice(0, m.index));
    if (m[1]) nodes.push(<a key={key++} href={m[3]} className="text-brand-600 underline" target="_blank" rel="noopener noreferrer">{m[2]}</a>);
    else if (m[4]) nodes.push(<strong key={key++}>{m[5]}</strong>);
    else if (m[6]) nodes.push(<em key={key++}>{m[7]}</em>);
    else if (m[8]) nodes.push(<code key={key++} className="px-1 py-0.5 rounded bg-gray-100 text-sm">{m[9]}</code>);
    remaining = remaining.slice(m.index + m[0].length);
  }
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("### ")) { blocks.push(<h3 key={key++} className="text-xl font-semibold mt-8 mb-3 text-gray-900">{inline(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith("## ")) { blocks.push(<h2 key={key++} className="text-2xl font-bold mt-10 mb-4 text-gray-900">{inline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith("# ")) { blocks.push(<h2 key={key++} className="text-2xl font-bold mt-10 mb-4 text-gray-900">{inline(line.slice(2))}</h2>); i++; continue; }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
      blocks.push(<ul key={key++} className="list-disc pl-6 my-4 space-y-1.5 text-gray-700">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,3} /.test(lines[i]) && !/^[-*] /.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push(<p key={key++} className="my-4 leading-relaxed text-gray-700">{inline(para.join(" "))}</p>);
  }
  return <div>{blocks}</div>;
}
