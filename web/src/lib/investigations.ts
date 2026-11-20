export interface Investigation {
  question: string;
  concepts: string[];
  task: string;
  destination: string;
  action: string;
  check: string;
  answer: string;
}

export const investigations: Investigation[] = [
  {
    question: "What does one pixel tell me about a place?",
    concepts: ["earth-observation","remote-sensing","satellite-imagery","coordinates","spatial-resolution","temporal-resolution","worldview"],
    task: "Open the California coast imagery timeline. Compare the dates and source labels of two frames before describing a change.",
    destination: "/region/california-coast/videos", action: "Inspect the California imagery timeline",
    check: "Can a sharper image tell you what happened more often?",
    answer: "Sharper pixels can reveal smaller features. To see what happened between two dates, you need more frequent observations.",
  },
  {
    question: "Is a hillside getting greener?",
    concepts: ["land-cover","sentinel","ndvi","greenness","seasonality","climate-twins"],
    task: "Open the Western Ghats case file. Check vegetation coverage and compare the same season across years. Use landscape and climate differences to interpret nearby comparisons.",
    destination: "/region/western-ghats", action: "Investigate the Western Ghats",
    check: "Would comparing a dry-season image with a monsoon image establish a long-term gain?",
    answer: "Seasonal growth alone could explain the difference. Compare equivalent months across several years and check cloud and coverage notes.",
  },
  {
    question: "Is the region warming over time?",
    concepts: ["temperature","time-series","trend","theil-sen","mann-kendall","significance","opposite-trends"],
    task: "Choose temperature on the global trend map. Read the slope units, then compare the direction of change with the number of cells that pass the significance test.",
    destination: "/trend", action: "Compare temperature trends on the map",
    check: "Do two positive slopes carry equally strong evidence?",
    answer: "Their rates, record lengths and variability can differ. Read the slope and the significance result together.",
  },
  {
    question: "Was this an unusual month?",
    concepts: ["precipitation","humidity","wind","solar-radiation","anomaly","mad","firms"],
    task: "In the North China Plain report, compare the monthly record with the Unusual months section. Read which variable triggered a flag and which period it was compared with.",
    destination: "/region/north-china-plain/report", action: "Read the North China Plain report",
    check: "Does a flagged hot month establish that a wildfire occurred?",
    answer: "It identifies an unusual reading. A fire investigation needs separate, dated evidence such as thermal detections and local reports.",
  },
  {
    question: "How much confidence should I place in a forecast?",
    concepts: ["time-series","forecast","uncertainty","coverage","synthetic-data"],
    task: "Find the five-year forecast in the California report. Read its band, then inspect the backtest and the source label before describing a possible future.",
    destination: "/region/california-coast/report", action: "Examine a forecast and its backtest",
    check: "If the center line rises, must the next observation rise?",
    answer: "The center line summarizes the model’s forecast distribution. Individual observations can fall on either side, including outside the estimated band.",
  },
  {
    question: "Why might the coast and inland areas differ?",
    concepts: ["coastal-climate","sst","sea-level","wind","opposite-trends"],
    task: "Open the California case file and check which marine variables have coverage. Compare a coastal location with a nearby inland location using a measure available at both.",
    destination: "/region/california-coast/map", action: "Explore the California coastal map",
    check: "Should an inland cell with no sea-surface temperature count as zero?",
    answer: "That measure is inapplicable there. Choose a shared variable such as air temperature and compare matching dates.",
  },
  {
    question: "Where did the numbers come from?",
    concepts: ["earthdata","power","noaa","coverage","synthetic-data"],
    task: "In the source directory, distinguish integrated products from optional services and external references. Then check the active source label on a case file.",
    destination: "/#sources", action: "Inspect the EarthPulse source directory",
    check: "Does a NASA reference on a page mean its example chart contains measured NASA data?",
    answer: "The active dataset label identifies the chart’s provenance. A synthetic dataset can demonstrate the same analysis as a measured record.",
  },
];
