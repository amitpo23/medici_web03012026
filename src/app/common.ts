export class CockpitCommon {
    // static dateFormatter: string | ValueFormatterFunc<any>;
    static dateFormatter(params: any) {
        let dateAsString = params.value;
        if (dateAsString == null) return '';
        // remove time
        let dateOnly = dateAsString.split('T');

        let dateParts = dateOnly[0].split('-');
        return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    }

    static _monthToNum(date: string) {
        if (date === undefined || date === null || date.length !== 10) {
            return null;
        }

        var yearNumber = parseInt(date.substring(6, 10));
        var monthNumber = parseInt(date.substring(3, 5));
        var dayNumber = parseInt(date.substring(0, 2));

        var result = yearNumber * 10000 + monthNumber * 100 + dayNumber;
        return result;
    }

    static perfirmDateFilter(filterLocalDateAtMidnight: any, cellValue: any) {
        if (cellValue == null) {
            return 0;
        }
        let dateOnly = cellValue.split('T');
        let dateParts = dateOnly[0].split('-');
        let year = Number(dateParts[0]);
        let month = Number(dateParts[1]) - 1;
        let day = Number(dateParts[2]);
        let cellDate = new Date(year, month, day);

        if (cellDate < filterLocalDateAtMidnight) {
            return -1;
        } else if (cellDate > filterLocalDateAtMidnight) {
            return 1;
        } else {
            return 0;
        }
    }

    static priceFormatter(params: any) {
        let presise = 100;

        if (params.value) {
            //let num = Math.round((params.value + Number.EPSILON) * presise) / presise;
            let num = params.value.toFixed(2);
            return `$${num}`;
        }

        return '';
    }
}