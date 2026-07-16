function generateToC(text) {
  const lines = text.split('\n');
  const toc = [];
  const chapterRegex = /^(?:chapter|第[一二三四五六七八九十百千万\d]+[章节回])|^(?:\#+)\s+/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 2 && line.length < 100 && chapterRegex.test(line)) {
      toc.push(line);
    }
  }
  return toc;
}
console.log(generateToC("Chapter 1: The Beginning\n\nSome text...\n\n# Main Idea\n\nText..."));
