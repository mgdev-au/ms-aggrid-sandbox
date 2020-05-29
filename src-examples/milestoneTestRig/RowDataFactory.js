import RefData from './RefData';

export default class RowDataFactory {

    createRowData() {
        const rowData = [];

        for (let i = 0; i < 2000; i++) {
            const countryData = RefData.COUNTRIES[i % RefData.COUNTRIES.length];
            rowData.push({
                name: RefData.FIRST_NAMES[i % RefData.FIRST_NAMES.length] + ' ' + RefData.LAST_NAMES[i % RefData.LAST_NAMES.length],
                skills: {
                    android: Math.random() < 0.4,
                    html5: Math.random() < 0.4,
                    mac: Math.random() < 0.4,
                    windows: Math.random() < 0.4,
                    css: Math.random() < 0.4
                },
                dob: RefData.DOB[i % RefData.DOB.length],
                bool: this.createRandomBool(),
                address: RefData.ADDRESSES[i % RefData.ADDRESSES.length], 
                years: Math.round(Math.random() * 100),
                proficiency: Math.round(Math.random() * 100),
                country: countryData.country,
                continent: countryData.continent,
                language: countryData.language,
                mobile: this.createRandomPhoneNumber(),
                landline: this.createRandomPhoneNumber(),
                eob: RefData.DOB[i % RefData.DOB.length],
                fob: RefData.DOB[i % RefData.DOB.length],
                gob: RefData.DOB[i % RefData.DOB.length],
                hob: RefData.DOB[i % RefData.DOB.length],
                iob: RefData.DOB[i % RefData.DOB.length],
            });
        }

        return rowData;
    }

    createRandomBool() {
        return Math.random() >= 0.5;
    }

    createRandomPhoneNumber() {
        let result = '+';
        for (let i = 0; i < 12; i++) {
            result += Math.round(Math.random() * 10);
            if (i === 2 || i === 5 || i === 8) {
                result += ' ';
            }
        }
        return result;
    }

}
