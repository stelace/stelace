/* global BootstrapService, ContentEntriesService */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const yaml = require('js-yaml');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    try {
        const translationsFolder = path.join(__dirname, '../translations');

        const rawJsonFrContent = fs.readFileSync(path.join(translationsFolder, './fr.json'), 'utf8');
        const rawJsonEnContent = fs.readFileSync(path.join(translationsFolder, './en.json'), 'utf8');
        const rawJsonContextContent = fs.readFileSync(path.join(translationsFolder, './context.json'), 'utf8');

        const jsonFrContent = JSON.parse(rawJsonFrContent);
        const jsonEnContent = JSON.parse(rawJsonEnContent);
        const jsonContextContent = JSON.parse(rawJsonContextContent);

        const keys = ContentEntriesService.getAllKeys(jsonEnContent);

        const newSourceJson = {};
        keys.forEach(key => {
            if (typeof _.get(jsonEnContent, key) !== 'undefined') {
                _.set(newSourceJson, `${key}.en`, _.get(jsonEnContent, key));
            }
            if (typeof _.get(jsonFrContent, key) !== 'undefined') {
                _.set(newSourceJson, `${key}.fr`, _.get(jsonFrContent, key));
            }
            if (typeof _.get(jsonContextContent, key) !== 'undefined') {
                _.set(newSourceJson, `${key}.context`, _.get(jsonContextContent, key));
            }
        });

        const newSourceYaml = yaml.safeDump(newSourceJson, {
            indent: 4,
            lineWidth: 10000,
        });

        const migrateYamlPath = path.join(translationsFolder, './build/main-migrate.yaml');
        fs.writeFileSync(migrateYamlPath, newSourceYaml, 'utf8');
    } catch (err) {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    } finally {
        sails.lowerSafe();
    }

});
