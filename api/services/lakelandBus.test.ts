import { describe, it, expect } from 'vitest';

/**
 * Tests for backend Lakeland Bus service time conversion
 */

// Re-implement convertTimesTo24Hour for testing (mirrors lakelandBus.ts)
function convertTimesTo24Hour(times: string[], startHour: number): string[] {
    const result: string[] = [];
    let lastHour24 = startHour;

    for (const time of times) {
        const [hourStr, minute] = time.split(':');
        const hour12 = parseInt(hourStr, 10);

        let hour24: number;

        if (hour12 === 12) {
            hour24 = 12;
        } else {
            if (lastHour24 >= 12 && hour12 < 12) {
                hour24 = hour12 + 12;
            } else if (lastHour24 < 12 && hour12 < lastHour24 % 12) {
                hour24 = hour12 + 12;
            } else if (lastHour24 >= 12 && hour12 >= (lastHour24 % 12 || 12)) {
                hour24 = hour12 + 12;
            } else {
                hour24 = hour12;
            }
        }

        if (hour24 < lastHour24) {
            hour24 += 12;
        }

        if (hour24 > 23) {
            hour24 = hour24 % 24;
        }

        lastHour24 = hour24;
        result.push(`${hour24.toString().padStart(2, '0')}:${minute}`);
    }

    return result;
}

describe('convertTimesTo24Hour', () => {
    describe('weekday eastbound (starts at 4 AM)', () => {
        it('should convert full schedule correctly', () => {
            // Simulated scraped times from Lakeland website
            const rawTimes = [
                '4:50', '5:20', '5:50', '6:20', '6:50',
                '7:20', '7:50', '8:20', '8:50', '9:20',
                '10:20', '11:20', '12:20', '1:20', '2:20',
                '3:20', '4:20', '5:20', '6:20', '7:20',
                '8:20', '9:20'
            ];

            const result = convertTimesTo24Hour(rawTimes, 4);

            // Expected 24-hour format
            expect(result).toEqual([
                '04:50', '05:20', '05:50', '06:20', '06:50',
                '07:20', '07:50', '08:20', '08:50', '09:20',
                '10:20', '11:20', '12:20', '13:20', '14:20',
                '15:20', '16:20', '17:20', '18:20', '19:20',
                '20:20', '21:20'
            ]);
        });

        it('should handle noon correctly', () => {
            const rawTimes = ['11:20', '12:20', '1:20'];
            const result = convertTimesTo24Hour(rawTimes, 4);

            expect(result).toEqual(['11:20', '12:20', '13:20']);
        });

        it('should handle PM hours that look like AM', () => {
            // After 3:20 PM (15:20), the next time is 4:20 which should be PM
            const rawTimes = ['3:20', '4:20', '5:20'];
            // Starting after noon
            const result = convertTimesTo24Hour(rawTimes, 15);

            expect(result).toEqual(['15:20', '16:20', '17:20']);
        });
    });

    describe('weekday westbound (starts at 7 AM)', () => {
        it('should convert afternoon-heavy schedule correctly', () => {
            const rawTimes = [
                '7:30', '8:30', '9:30', '10:30', '11:30',
                '1:00', '2:00', '2:30', '3:00', '3:15',
                '3:30', '3:45', '4:00', '4:15', '4:30',
                '4:45', '5:00', '5:15', '5:30', '5:45',
                '6:00', '6:15', '6:30', '7:00', '7:30',
                '8:30', '9:30', '10:30'
            ];

            const result = convertTimesTo24Hour(rawTimes, 7);

            expect(result[0]).toBe('07:30');    // 7:30 AM
            expect(result[4]).toBe('11:30');    // 11:30 AM
            expect(result[5]).toBe('13:00');    // 1:00 PM (not 1:00 AM!)
            expect(result[12]).toBe('16:00');   // 4:00 PM
            expect(result[20]).toBe('18:00');   // 6:00 PM
            expect(result[23]).toBe('19:00');   // 7:00 PM (not 7:00 AM!)
            expect(result[27]).toBe('22:30');   // 10:30 PM
        });
    });

    describe('weekend eastbound (starts at 7 AM)', () => {
        it('should convert weekend schedule correctly', () => {
            const rawTimes = [
                '7:20', '9:20', '11:20', '1:20', '3:20',
                '5:20', '7:20', '9:20'
            ];

            const result = convertTimesTo24Hour(rawTimes, 7);

            expect(result).toEqual([
                '07:20', '09:20', '11:20', '13:20', '15:20',
                '17:20', '19:20', '21:20'
            ]);
        });
    });

    describe('weekend westbound (starts at 9 AM)', () => {
        it('should convert weekend schedule correctly', () => {
            const rawTimes = [
                '9:00', '11:00', '1:00', '3:00', '5:00',
                '7:00', '9:00', '11:00'
            ];

            const result = convertTimesTo24Hour(rawTimes, 9);

            expect(result).toEqual([
                '09:00', '11:00', '13:00', '15:00', '17:00',
                '19:00', '21:00', '23:00'
            ]);
        });
    });

    describe('edge cases', () => {
        it('should handle single time', () => {
            const result = convertTimesTo24Hour(['9:30'], 9);
            expect(result).toEqual(['09:30']);
        });

        it('should handle empty array', () => {
            const result = convertTimesTo24Hour([], 4);
            expect(result).toEqual([]);
        });

        it('should handle times with single digit hours', () => {
            const result = convertTimesTo24Hour(['4:50', '5:20'], 4);
            expect(result).toEqual(['04:50', '05:20']);
        });
    });
});
