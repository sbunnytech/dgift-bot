export default function matrixDesign({ title, content, footer, brand }) {
  return `[ ${title} ]
> ${content.replace(/\n/g, '\n> ')}
[ ${footer} ]`
}