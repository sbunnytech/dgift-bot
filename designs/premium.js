export default function premiumDesign({ title, content, footer, brand }) {
  return `★彡 ${title} 彡★
╭──────────────────╮
${content.split('\n').map(l => `│ ${l}`).join('\n')}
╰──────────────────╯
✧ ${footer} ✧`
}