/* global CustomAttributesService */

const { expect } = require('chai');

const customAttributes = [
    { name: 'height', label: 'Height', type: 'number', filter: false, visibility: 'admin', minValue: 10, maxValue: 654, defaultValue: 50 },
    { name: 'transport', label: 'Transport', type: 'boolean', filter: false, visibility: 'admin', defaultValue: false },
    { name: 'lastCheckDate', label: 'Last time checking', type: 'date', filter: false, visibility: 'admin' },
    { name: 'reference', label: 'Reference', type: 'text', filter: false, visibility: 'admin', minLength: 10, maxLength: 10 },
    { name: 'description', label: 'Description', type: 'textarea', filter: false, visibility: 'admin', maxLength: 1000 },
    { name: 'skills', label: 'Skills', type: 'checkbox', filter: false, visibility: 'admin',
        choices: [
            { value: 'walk', label: 'Walking' },
            { value: 'swim', label: 'Swim' },
            { value: 'fly', label: 'Fly' },
        ],
    },
    { name: 'school', label: 'School', type: 'select', filter: false, visibility: 'admin',
        choices: [
            { value: 'A', label: 'School A' },
            { value: 'B', label: 'School B' },
            { value: 'C', label: 'School C' },
        ]
    },
];

describe('CustomAttributesService', () => {
    describe('.isValidCustomAttributes()', () => {
        it('validates provided custom attributes', () => {
            const valid = CustomAttributesService.isValidCustomAttributes(customAttributes);
            expect(valid).to.equal(true);
        });

        it('must have unique custom attribute name', () => {
            const cloneCustomAttributes = customAttributes.slice();
            cloneCustomAttributes.push({ name: 'height', label: 'Height', type: 'number', filter: false, visibility: 'admin' });
            const valid = CustomAttributesService.isValidCustomAttributes(cloneCustomAttributes);
            expect(valid).to.equal(false);
        });
    });

    describe('.checkData()', () => {
        it('complies with the schema', () => {
            const data = {
                height: 20,
                transport: true,
                skills: ['walk', 'fly'],
                school: 'A',
            };

            const res = CustomAttributesService.checkData(data, customAttributes);
            expect(typeof res.newData).to.equal('object');
            expect(res.valid).to.equal(true);
        });

        it('fills data with default values', () => {
            const data = {
                height: 20,
            };

            const res = CustomAttributesService.checkData(data, customAttributes);
            expect(res.newData.transport).equal(false);
        });
    });
});
