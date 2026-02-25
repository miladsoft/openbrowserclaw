import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/markdown.js';

describe('renderMarkdown', () => {
  // ---------------------------------------------------------------------------
  // Headings
  // ---------------------------------------------------------------------------

  it('renders h1', () => {
    expect(renderMarkdown('# Hello')).toContain('<h1>Hello</h1>');
  });

  it('renders h2', () => {
    expect(renderMarkdown('## Sub')).toContain('<h2>Sub</h2>');
  });

  it('renders h3', () => {
    expect(renderMarkdown('### Deep')).toContain('<h3>Deep</h3>');
  });

  // ---------------------------------------------------------------------------
  // Inline formatting
  // ---------------------------------------------------------------------------

  it('renders bold', () => {
    const html = renderMarkdown('**bold**');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('renders italic with asterisk', () => {
    const html = renderMarkdown('*italic*');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders inline code', () => {
    const html = renderMarkdown('use `fetch()`');
    expect(html).toContain('<code>fetch()</code>');
  });

  it('renders strikethrough', () => {
    const html = renderMarkdown('~~deleted~~');
    expect(html).toContain('<del>deleted</del>');
  });

  // ---------------------------------------------------------------------------
  // Code blocks
  // ---------------------------------------------------------------------------

  it('renders fenced code block', () => {
    const md = '```js\nconsole.log("hi");\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).toContain('console.log');
  });

  it('escapes HTML inside code blocks', () => {
    const md = '```\n<script>alert("xss")</script>\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  // ---------------------------------------------------------------------------
  // Lists
  // ---------------------------------------------------------------------------

  it('renders unordered list', () => {
    const md = '- item 1\n- item 2\n- item 3';
    const html = renderMarkdown(md);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('item 1');
    expect(html).toContain('item 3');
  });

  it('renders ordered list', () => {
    const md = '1. first\n2. second';
    const html = renderMarkdown(md);
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>');
    expect(html).toContain('first');
  });

  // ---------------------------------------------------------------------------
  // Links & images
  // ---------------------------------------------------------------------------

  it('renders links', () => {
    const html = renderMarkdown('[Google](https://google.com)');
    expect(html).toContain('<a href="https://google.com"');
    expect(html).toContain('Google</a>');
  });

  it('renders images', () => {
    const html = renderMarkdown('![alt](https://img.png)');
    expect(html).toContain('<img');
    expect(html).toContain('src="https://img.png"');
  });

  // ---------------------------------------------------------------------------
  // Blockquotes
  // ---------------------------------------------------------------------------

  it('renders blockquote', () => {
    const html = renderMarkdown('> quoted text');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('quoted text');
  });

  // ---------------------------------------------------------------------------
  // Horizontal rule
  // ---------------------------------------------------------------------------

  it('renders horizontal rule', () => {
    const html = renderMarkdown('---');
    expect(html).toContain('<hr');
  });

  // ---------------------------------------------------------------------------
  // Tables
  // ---------------------------------------------------------------------------

  it('renders tables', () => {
    const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |';
    const html = renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th');
    expect(html).toContain('Alice');
  });

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------

  it('escapes HTML to prevent XSS', () => {
    const html = renderMarkdown('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('handles empty input', () => {
    expect(renderMarkdown('')).toBeDefined();
  });

  it('handles plain text', () => {
    const html = renderMarkdown('Just some text');
    expect(html).toContain('Just some text');
  });

  it('handles Windows line endings', () => {
    const html = renderMarkdown('# Title\r\n\r\nParagraph');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('Paragraph');
  });
});
