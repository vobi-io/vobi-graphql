#!/usr/bin/env node

const program = require('commander')
const fetch = require('isomorphic-fetch')
const fs = require('fs')

const handlebars = require('./hbs')

const templatesDir = __dirname + '/templates'
const gqlDir = __dirname + '/gql'

// const argsTmpl = (args) => {
//   let argsString = ''
//   args.forEach((arg, i) => {
//     argsString += `${arg.name}: ${arg.type.name}${!!arg.defaultValue ? ` = ${arg.defaultValue}` : ''}${(i === (args.length - 1)) ? '' : ', '}`
//   })
//   return argsString
// }

// const fieldsTmpl = fields => {
//   let fieldsStr =
//   ` {
//     `
//     fields.forEach((field, i) => {
//       if (field.type.kind === 'SCALAR') {
//         fieldsStr +=
//     `${field.name}`
//         if (i !== fields.length - 1){
//           fieldsStr += `
//     `
//         }
//       }
//       return ''
//     })
//   fieldsStr += `
//   }`
//   return fieldsStr
// }

// const queryTmpl = field => `
//   query ${field.name}${field.args.length > 0 ? `(${argsTmpl(field.args)})` : ''}${field.type.kind === 'OBJECT' ? fieldsTmpl(field.type.fields) : ''}`

program
  .version('0.0.1', '-v, --version')
  .parse(process.argv)

program
  .command('generate <url>')
  .alias('gen')
  .description('generate graphql queries and mutations from schema from given url')
  .action(async (cmd, options) => {
    fetch(cmd, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: `{
          __type(name: "Mutation") {
            name
            kind
            fields {
              name
              type {
                name
                kind
                fields {
                  name
                  type {
                    kind
                    name
                  }
                }
              }
              args {
                name
                type {
                  name
                  kind
                }
                defaultValue
              }

            }
          }
        }`
      })
    })
      .then(r => r.json())
      .then(r => r.data.__type.fields)
      .then(fields => {
        fields.forEach(field => {
          // const f = queryTmpl(field)
          // fs.writeFileSync(`./gql/queries/${field.name}.gql`, f)
          // console.log(f)

          const source = fs.readFileSync(`${templatesDir}/mutation.hbs`, 'utf8')
          const template = handlebars.compile(source, { strict: true })
          const result = template(field)

          fs.writeFileSync(`${gqlDir}/mutations/${field.name}.gql`, result)
        })
      })

    console.log('exec "%s"', cmd)

    fetch(cmd, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: `{
          __type(name: "Query") {
            name
            kind
            fields {
              name
              type {
                name
                kind
                fields {
                  name
                  type {
                    kind
                    name
                  }
                }
              }
              args {
                name
                type {
                  name
                  kind
                }
                defaultValue
              }

            }
          }
        }`
      })
    })
      .then(r => r.json())
      .then(r => r.data.__type.fields)
      .then(fields => {
        fields.forEach(field => {
          // const f = queryTmpl(field)
          // fs.writeFileSync(`./gql/queries/${field.name}.gql`, f)
          // console.log(f)

          const source = fs.readFileSync(`${templatesDir}/query.hbs`, 'utf8')
          const template = handlebars.compile(source, { strict: true })
          const result = template(field)

          fs.writeFileSync(`${gqlDir}/queries/${field.name}.gql`, result)
        })
      })

    console.log('exec "%s"', cmd)
  })

program.parse(process.argv)
