/* global ContentEntriesService */

const { expect } = require('chai');

const translations = {
    landing: {
        homepage: {
            title: 'Welcome to {SERVICE_NAME}',
            title__EDITOR_LABEL: 'Title of your website',
            title__EDITOR_HELPER: 'As shown in Web browser and search engine results such as Google.',
            header: 'Welcome to {SERVICE_NAME}',
            header__EDITOR_LABEL: 'Main header of your homepage',
            header__EDITOR_HELPER: 'Try to describe your activity precisely to improve your SEO.',
            subheader: 'Your community',
            main_cta: 'New listing',
            main_cta__EDITOR_LABEL: 'Homepage call-to-action (new listing)',
        },
        terms: {
            header: 'Terms of use',
            last_update_date: 'Last Updated: {date}',
            content: 'Writing in progress'
        },
    },
    navigation: {
        home: 'Home',
        new_listing: 'New listing',
        new_listing__EDITOR_LABEL: 'New listing link',
        contact_us: 'Contact us',
    },
};
const userTranslations = {
    landing: {
        homepage: {
            title: 'Hello everyone!',
            header: 'The next step',
            mini_header: 'The return'
        },
        terms: {
            header: 'Rules',
        },
    },
    navigation: {
        home: 'Home',
    },
};

describe('ContentEntriesService', () => {
    describe('.parseMetadata()', () => {
        it('parses metadata', () => {
            const expected = {
                editableKeys: [
                    'pages.homepage.title',
                    'pages.homepage.header',
                    'pages.homepage.main_cta',
                    'navigation.new_listing',
                ],
                keys: [
                    'pages.homepage.title',
                    'pages.homepage.header',
                    'pages.homepage.subheader',
                    'pages.homepage.main_cta',
                    'pages.terms.header',
                    'pages.terms.last_update_date',
                    'pages.terms.content',
                    'navigation.home',
                    'navigation.new_listing',
                    'navigation.contact_us',
                ],
                helpers: [
                    'pages.homepage.title__EDITOR_HELPER',
                    'pages.homepage.header__EDITOR_HELPER',
                ],
            };

            const parsed = ContentEntriesService.parseMetadata(translations);

            expect(parsed.editableKeys).to.deep.equal(expected.editableKeys);
            expect(parsed.keys).to.deep.equal(expected.keys);
            expect(parsed.helpers).to.deep.equal(expected.helpers);
        });
    });

    describe('.computeTranslations()', () => {
        it('returns merged values', () => {
            const metadata = ContentEntriesService.parseMetadata(translations);

            const expected = {
                landing: {
                    homepage: {
                        title: 'Hello everyone!',
                        header: 'The next step',
                        subheader: 'Your community',
                        main_cta: 'New listing',
                    },
                    terms: {
                        header: 'Rules',
                        last_update_date: 'Last Updated: {date}',
                        content: 'Writing in progress'
                    },
                },
                navigation: {
                    home: 'Home',
                    new_listing: 'New listing',
                    contact_us: 'Contact us',
                },
            };

            const computedTranslations = ContentEntriesService.computeTranslations({
                translations,
                userTranslations,
                metadata,
                displayContext: false,
                onlyEditableKeys: false,
            });
            expect(computedTranslations).to.deep.equal(expected);
        });

        it('returns only editable values', () => {
            const metadata = ContentEntriesService.parseMetadata(translations);

            const expected = {
                landing: {
                    homepage: {
                        title: 'Hello everyone!',
                        header: 'The next step',
                        main_cta: 'New listing',
                    },
                },
                navigation: {
                    new_listing: 'New listing',
                },
            };

            const computedTranslations = ContentEntriesService.computeTranslations({
                translations,
                userTranslations,
                metadata,
                displayContext: false,
                onlyEditableKeys: true,
            });
            expect(computedTranslations).to.deep.equal(expected);
        });

        it('displays keys context', () => {
            const metadata = ContentEntriesService.parseMetadata(translations);

            const expected = {
                landing: {
                    homepage: {
                        title: 'Hello everyone!',
                        title__EDITOR_LABEL: 'Title of your website',
                        title__EDITOR_HELPER: 'As shown in Web browser and search engine results such as Google.',
                        header: 'The next step',
                        header__EDITOR_LABEL: 'Main header of your homepage',
                        header__EDITOR_HELPER: 'Try to describe your activity precisely to improve your SEO.',
                        main_cta: 'New listing',
                        main_cta__EDITOR_LABEL: 'Homepage call-to-action (new listing)',
                    },
                },
                navigation: {
                    new_listing: 'New listing',
                    new_listing__EDITOR_LABEL: 'New listing link',
                },
            };

            const computedTranslations = ContentEntriesService.computeTranslations({
                translations,
                userTranslations,
                metadata,
                displayContext: true,
                onlyEditableKeys: true,
            });
            expect(computedTranslations).to.deep.equal(expected);
        });
    });
});
