#!/usr/bin/env node

const program = require('commander');
const fetch = require('isomorphic-fetch');
const fs = require('fs');
const { getIntrospectionQuery } = require('graphql/utilities/introspectionQuery');
const { buildClientSchema } = require('graphql/utilities/buildClientSchema');
const path = require('path');
const del = require('del');
const chalk = require('chalk');

const addQueryDepthLimit = 100;

function cleanName(name) {
  return name.replace(/[[\]!]/g, '');
}

function generateQuery(curName, curParentType, gqlSchema) {
  let query = '';
  const hasArgs = false;
  const argTypes = [];

  function generateFieldData(name, parentType, parentFields, level) {
    const tabSize = 2;
    const field = gqlSchema.getType(parentType).getFields()[name];

    const meta = {
      hasArgs: false,
    };

    let fieldStr = ' '.repeat(level * tabSize) + field.name;

    if (field.args && field.args.length) {
      meta.hasArgs = true;

      const argsList = field.args
        .reduce((acc, cur) => `${acc}, ${cur.name}: $${cur.name}`, '')
        .substring(2);

      fieldStr += `(${argsList})`;

      field.args.forEach((arg) => {
        argTypes.push({
          name: `$${arg.name}`,
          type: arg.type,
        });
      });
    }

    const curTypeName = cleanName(field.type.inspect());
    const curType = gqlSchema.getType(curTypeName);

    if (parentFields.filter(x => x.type === curTypeName).length) {
      return { query: '', meta: {} };
    }

    if (level >= addQueryDepthLimit) {
      return { query: '', meta: {} };
    }

    const innerFields = curType.getFields && curType.getFields();
    let innerFieldsData = null;
    if (innerFields) {
      innerFieldsData = Object.keys(innerFields)
        .reduce((acc, cur) => {
          if (
            parentFields.filter(x => x.name === cur && x.type === curTypeName)
              .length
          ) {
            return '';
          }

          const curInnerFieldData = generateFieldData(
            cur,
            curTypeName,
            [...parentFields, { name, type: curTypeName }],
            level + 1,
          );
          const curInnerFieldStr = curInnerFieldData.query;

          meta.hasArgs = meta.hasArgs || curInnerFieldData.meta.hasArgs;

          if (!curInnerFieldStr) {
            return acc;
          }

          return `${acc}\n${curInnerFieldStr}`;
        }, '')
        .substring(1);
    }

    if (innerFieldsData) {
      fieldStr += ` {\n${innerFieldsData}\n`;
      fieldStr += `${' '.repeat(level * tabSize)}}`;
    }

    return { query: fieldStr, meta };
  }

  const fieldData = generateFieldData(curName, curParentType, [], 1);

  const argStr = argTypes
    .map(argType => `${argType.name}: ${argType.type}`)
    .join(', ');

  switch (curParentType) {
    case gqlSchema.getQueryType() && gqlSchema.getQueryType().name:
      query += `query ${curName}${argStr ? `(${argStr})` : ''}`;
      break;
    case gqlSchema.getMutationType() && gqlSchema.getMutationType().name:
      query += `mutation ${curName}${argStr ? `(${argStr})` : ''}`;
      break;
    case gqlSchema.getSubscriptionType()
      && gqlSchema.getSubscriptionType().name:
      query += `subscription ${curName}${argStr ? `(${argStr})` : ''}`;
      break;
    default:
      throw new Error('parentType is not one of mutation/query/subscription');
  }

  query += ` {\n${fieldData.query}\n}`;

  const meta = { ...fieldData.meta };

  meta.hasArgs = hasArgs || meta.hasArgs;

  return { query, meta };
}
program
  .version('0.0.1', '-v, --version')
  .parse(process.argv);

program
  .command('generate')
  .alias('gen')
  .description('generate graphql queries, mutations and subscriptions from schema of given url')
  .option('-c, --config [config]', 'Config path. Defaults to ./.gql-gen.json', './.gqlgen.json')
  .option('-e, --endpoint [endpoint]', 'Graphql endpoint recursively')
  .option('-s, --schema [schema]', 'Graphql schema path')
  .option('-d, --dir [dir]', 'Destination directory. Defaults to "gql" dir in working directory', `${__dirname}/gql`)
  .option('-g, --gen-dir [genDir]', 'Generated directory name inside destination directory. Defaults to "generated"', 'generated')
  .parse(process.argv)
  .action(async (params) => {
    let options = params;
    if (fs.existsSync(options.config)) {
      const fileConfig = JSON.parse(fs.readFileSync(options.config, 'utf8'));
      options = Object.assign({}, options, fileConfig);
    }
    if (!options.endpoint && !options.schema) {
      console.error(chalk.red('Please provide graphql endpoint or schema'));
      return;
    }

    const gqlDir = options.dir;
    if (!fs.existsSync(gqlDir)) {
      fs.mkdirSync(gqlDir);
    }
    const gqlGeneratedDir = `${gqlDir}/${options.genDir}`;
    del.sync(gqlGeneratedDir);
    fs.mkdirSync(gqlGeneratedDir);

    const { endpoint } = options;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: getIntrospectionQuery() }),
    });
    const { data, errors } = await response.json();

    if (errors) {
      throw new Error(JSON.stringify(errors, null, 2));
    }

    const schema = buildClientSchema(data);

    const entities = ['Mutation', 'Query', 'Subscription'];
    entities.forEach((entity) => {
      const funcName = `get${entity}Type`;
      if (schema[funcName]()) {
        const entityInPlural = entity === 'Query'
          ? 'queries' : `${entity.toLowerCase()}s`;
        console.log(chalk.green(`Generating ${entityInPlural}...`));
        const dir = path.join(gqlGeneratedDir, `./${entity.toLowerCase()}`);
        del.sync(dir);
        fs.mkdirSync(dir);

        Object.keys(schema[funcName]().getFields()).forEach((itemType) => {
          const { query } = generateQuery(itemType, entity, schema);
          fs.writeFileSync(path.join(dir, `./${itemType}.gql`), query);
        });
        console.log(chalk.green.bold('Done!'));
      }
    });
  });


program.parse(process.argv);
