export class CockpitCommon {
    // static dateFormatter: string | ValueFormatterFunc<any>;
    static dateFormatter(params: any) {
        const dateAsString = params.value;
        if (dateAsString == null) return '';
        // remove time
        const dateOnly = dateAsString.split('T');

        const dateParts = dateOnly[0].split('-');
        return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    }

    static _monthToNum(date: string) {
        if (date === undefined || date === null || date.length !== 10) {
            return null;
        }

        const yearNumber = parseInt(date.substring(6, 10));
        const monthNumber = parseInt(date.substring(3, 5));
        const dayNumber = parseInt(date.substring(0, 2));

        const result = yearNumber * 10000 + monthNumber * 100 + dayNumber;
        return result;
    }

    static perfirmDateFilter(filterLocalDateAtMidnight: any, cellValue: any) {
        if (cellValue == null) {
            return 0;
        }
        const dateOnly = cellValue.split('T');
        const dateParts = dateOnly[0].split('-');
        const year = Number(dateParts[0]);
        const month = Number(dateParts[1]) - 1;
        const day = Number(dateParts[2]);
        const cellDate = new Date(year, month, day);

        if (cellDate < filterLocalDateAtMidnight) {
            return -1;
        } else if (cellDate > filterLocalDateAtMidnight) {
            return 1;
        } else {
            return 0;
        }
    }

    static priceFormatter(params: any) {
        const presise = 100;

        if (params.value) {
            //let num = Math.round((params.value + Number.EPSILON) * presise) / presise;
            const num = params.value.toFixed(2);
            return `$${num}`;
        }

        return '';
    }
}