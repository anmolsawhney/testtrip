/**
 * @description
 * This file contains utility functions for parsing and rendering simple markdown-like syntax
 * into React components. This provides a safe way to render rich content without using
 * `dangerouslySetInnerHTML`.
 *
 * Key features:
 * - renderSimpleMarkdown: Converts markdown-style links `[text](url)` into clickable `<a>` tags.
 */

import React from "react"

/**
 * Parses a string containing simple markdown links and returns an array of React nodes.
 * e.g., "Check out [this link](https://example.com)" becomes ["Check out ", <a href="...">this link</a>]
 * @param text The string content to parse.
 * @returns An array of React.ReactNode elements.
 */
export function renderSimpleMarkdown(text: string): React.ReactNode[] {
  // Regex to find markdown links: [linkText](linkUrl)
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  const elements: React.ReactNode[] = []
  let lastIndex = 0
  let match

  // Iterate over all matches in the text
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    // Push the plain text part that comes before the link
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index))
    }

    const [fullMatch, linkText, linkUrl] = match

    // Push the actual link element (<a> tag)
    elements.push(
      <a
        key={match.index}
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline dark:text-blue-400"
        onClick={e => e.stopPropagation()} // Prevent parent click handlers (e.g., message bubble)
      >
        {linkText}
      </a>
    )

    lastIndex = markdownLinkRegex.lastIndex
  }

  // Push any remaining plain text after the last link
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex))
  }

  return elements
}
