const handlebars = require('handlebars');
const fs = require('fs');

const partialsDir = __dirname + '/templates/partials'

const filenames = fs.readdirSync(partialsDir)

filenames.forEach(function (filename) {
  const matches = /^([^.]+).hbs$/.exec(filename)
  if (!matches) {
    return;
  }
  const name = matches[1];
  const template = fs.readFileSync(`${partialsDir}/${filename}`, 'utf8')
  handlebars.registerPartial(name, template)
})

handlebars.registerHelper('ifNotLastArg', (a, b, options) => {
  if (a < (b - 1)) {
    return options.fn(this)
  }
  return options.inverse(this)
})

module.exports = handlebars
