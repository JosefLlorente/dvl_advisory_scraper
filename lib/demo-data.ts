import type { Advisory, DashboardData } from "@/lib/types";

const scrapedAt = "2026-09-05T08:00:00.000Z";

export const DEMO_ADVISORIES: Advisory[] = [
  {
    id: "demo-sept-8",
    sourceUrl:
      "https://www.davaolight.com/post/scheduled-power-interruption-on-september-8-in-davao-city",
    title: "Scheduled power interruption on September 8 in Davao City",
    rawText:
      "Davao Light will conduct a ten-hour switching power interruption from 5:00 a.m. to 3:00 p.m. on Tuesday, September 8, 2026, to facilitate net metering and recloser installation at Hedcor Talomo Plant 3. Specifically affected are customers from Purok 24 Samulco Village along Catalunan Pequeno Road going to Cawa Cawa, including Hedcor Talomo Plant 3, Villa Constancia Subdivision, and nearby areas.",
    advisoryType: "switching",
    status: "upcoming",
    isCancelledBySource: false,
    reason: "net metering and recloser installation at Hedcor Talomo Plant 3",
    publishedAt: "2026-09-05T06:06:35.920Z",
    scrapedAt,
    parseConfidence: "high",
    parserVersion: 1,
    windows: [
      {
        id: "demo-sept-8-w1",
        advisoryId: "demo-sept-8",
        startAt: "2026-09-07T21:00:00.000Z",
        endAt: "2026-09-08T07:00:00.000Z",
        rawDateText: "from 5:00 a.m. to 3:00 p.m. on Tuesday, September 8, 2026",
      },
    ],
    areas: [
      {
        id: "demo-sept-8-a1",
        advisoryId: "demo-sept-8",
        rawText: "Purok 24 Samulco Village along Catalunan Pequeno Road going to Cawa Cawa",
        normalizedName: "Catalunan Pequeno",
        barangay: "Catalunan Pequeno",
        lat: 7.0732,
        lng: 125.5451,
        geocodeConfidence: "approximate",
      },
      {
        id: "demo-sept-8-a2",
        advisoryId: "demo-sept-8",
        rawText: "Hedcor Talomo Plant 3",
        normalizedName: "Hedcor Talomo Plant 3",
        barangay: null,
        lat: null,
        lng: null,
        geocodeConfidence: "failed",
      },
      {
        id: "demo-sept-8-a3",
        advisoryId: "demo-sept-8",
        rawText: "Villa Constancia Subdivision",
        normalizedName: "Villa Constancia Subdivision",
        barangay: "Catalunan Pequeno",
        lat: 7.0694,
        lng: 125.5418,
        geocodeConfidence: "approximate",
      },
    ],
  },
  {
    id: "demo-sept-6",
    sourceUrl:
      "https://www.davaolight.com/post/switching-power-interruptions-on-september-6-and-7-in-the-cities-of-davao-and-panabo",
    title:
      "Switching power interruptions on September 6 and 7 in the Cities of Davao and Panabo",
    rawText:
      "Switching power interruptions on Sunday and Monday, September 6 and 7, 2026, affecting some parts of Davao City and Panabo City.",
    advisoryType: "switching",
    status: "upcoming",
    isCancelledBySource: false,
    reason: "substation works at San Pedro Substation and Lanang Substation",
    publishedAt: "2026-09-04T08:00:00.000Z",
    scrapedAt,
    parseConfidence: "high",
    parserVersion: 1,
    windows: [
      {
        id: "demo-sept-6-w1",
        advisoryId: "demo-sept-6",
        startAt: "2026-09-05T21:00:00.000Z",
        endAt: "2026-09-05T22:00:00.000Z",
        rawDateText: "between 5:00 a.m. and 6:00 a.m. on Sunday, September 6",
      },
      {
        id: "demo-sept-6-w2",
        advisoryId: "demo-sept-6",
        startAt: "2026-09-05T16:01:00.000Z",
        endAt: "2026-09-06T16:00:00.000Z",
        rawDateText: "between 12:01 a.m. and 2:00 a.m. on Sunday, September 6 and Monday, September 7",
      },
    ],
    areas: [
      {
        id: "demo-sept-6-a1",
        advisoryId: "demo-sept-6",
        rawText: "Panabo Wharf area, from Petron Gas Station to Anflo Industrial Estate",
        normalizedName: "Panabo Wharf",
        barangay: null,
        lat: 7.3081,
        lng: 125.6842,
        geocodeConfidence: "approximate",
      },
      {
        id: "demo-sept-6-a2",
        advisoryId: "demo-sept-6",
        rawText: "SM Lanang and nearby areas",
        normalizedName: "SM Lanang",
        barangay: "Lanang",
        lat: 7.0984,
        lng: 125.6308,
        geocodeConfidence: "approximate",
      },
    ],
  },
  {
    id: "demo-cancelled",
    sourceUrl:
      "https://www.davaolight.com/post/switching-power-interruptions-on-september-5-and-6-in-davao-city",
    title: "CANCELLED: Switching power interruptions on September 5 and 6 in Davao City",
    rawText:
      "This scheduled power interruption has been cancelled due to necessary operational adjustments.",
    advisoryType: "switching",
    status: "cancelled",
    isCancelledBySource: true,
    reason: "necessary operational adjustments",
    publishedAt: "2026-09-03T08:00:00.000Z",
    scrapedAt,
    parseConfidence: "high",
    parserVersion: 1,
    windows: [
      {
        id: "demo-cancelled-w1",
        advisoryId: "demo-cancelled",
        startAt: "2026-09-05T15:00:00.000Z",
        endAt: "2026-09-05T23:00:00.000Z",
        rawDateText: "from 11:00 p.m. on Saturday, September 5, to 7:00 a.m. on Sunday, September 6",
      },
    ],
    areas: [
      {
        id: "demo-cancelled-a1",
        advisoryId: "demo-cancelled",
        rawText: "MacArthur Highway, Matina, including NCCC Centerpoint",
        normalizedName: "Matina",
        barangay: "Matina Crossing",
        lat: 7.0552,
        lng: 125.5754,
        geocodeConfidence: "barangay_centroid",
      },
    ],
  },
  {
    id: "demo-aug-23",
    sourceUrl:
      "https://www.davaolight.com/post/8-hour-power-interruption-on-august-23-in-catigan-davao-city",
    title: "8-hour power interruption on August 23 in Catigan, Davao City",
    rawText:
      "An eight-hour power interruption on Sunday, August 23, 2026, from 7:00 a.m. to 3:00 p.m., affecting customers in Catigan, Davao City.",
    advisoryType: "scheduled",
    status: "completed",
    isCancelledBySource: false,
    reason: "line upgrading works",
    publishedAt: "2026-08-20T08:00:00.000Z",
    scrapedAt,
    parseConfidence: "high",
    parserVersion: 1,
    windows: [
      {
        id: "demo-aug-23-w1",
        advisoryId: "demo-aug-23",
        startAt: "2026-08-22T23:00:00.000Z",
        endAt: "2026-08-23T07:00:00.000Z",
        rawDateText: "from 7:00 a.m. to 3:00 p.m. on Sunday, August 23, 2026",
      },
    ],
    areas: [
      {
        id: "demo-aug-23-a1",
        advisoryId: "demo-aug-23",
        rawText: "the entire Catigan, from the Task Force checkpoint corner Sirawan and Catigan Road",
        normalizedName: "Catigan",
        barangay: "Catigan",
        lat: 6.9991,
        lng: 125.4798,
        geocodeConfidence: "barangay_centroid",
      },
    ],
  },
];

export const DEMO_DASHBOARD: DashboardData = {
  advisories: DEMO_ADVISORIES,
  lastUpdated: scrapedAt,
  source: "demo",
};
