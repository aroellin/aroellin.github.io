// --- Configuration ---
const CONFIG = {
    numTrainPoints: 30,
    numTestPoints: 50,
    trueSlope: 1.5,
    trueIntercept: 10,
    noiseStdDev: 15,
    xRange: [0, 100],
    yRange: [0, 180], // Adjust based on slope/intercept/noise
    handleRadius: 8,
};

// --- State Variables ---
let trainData = [];
let testData = [];
let userLineHandles = []; // [{x, y}, {x, y}] in pixel coordinates
let userLineParams = { slope: 0, intercept: 0 }; // In data coordinates
let svg, xScale, yScale, lineGenerator;
let isTested = false;
let innerWidth, innerHeight; // Store chart dimensions

// --- Utility Functions ---

function gaussianRandom(mean = 0, stdev = 1) {
    let u = 1 - Math.random();
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
}

function generateData(n, slope, intercept, noise, xRange) {
    const data = [];
    const [xMin, xMax] = xRange;
    for (let i = 0; i < n; i++) {
        const x = Math.random() * (xMax - xMin) + xMin;
        const y = slope * x + intercept + gaussianRandom(0, noise);
        data.push({ x, y });
    }
    return data;
}

function calculateLineParams(handle1_px, handle2_px) {
    const p1 = { x: xScale.invert(handle1_px.x), y: yScale.invert(handle1_px.y) };
    const p2 = { x: xScale.invert(handle2_px.x), y: yScale.invert(handle2_px.y) };
    if (Math.abs(p1.x - p2.x) < 1e-6) {
        return { slope: Infinity, intercept: p1.x };
    }
    const slope = (p2.y - p1.y) / (p2.x - p1.x);
    const intercept = p1.y - slope * p1.x;
    return { slope, intercept };
}

function calculateMSE(data, slope, intercept) {
    if (!data || data.length === 0 || !isFinite(slope)) return Infinity;
    let sumSquaredError = 0;
    data.forEach(d => {
        const yPred = slope * d.x + intercept;
        sumSquaredError += Math.pow(d.y - yPred, 2);
    });
    return sumSquaredError / data.length;
}

function getScoreFeedback(mse) {
    if (!isFinite(mse)) return "Hmm, the line seems vertical?";
    if (mse < 50) return "Excellent fit!";
    if (mse < 150) return "Great job!";
    if (mse < 400) return "Good fit!";
    if (mse < 1000) return "Not bad, try adjusting!";
    return "Keep trying to improve the fit!";
}

// --- NEW: Regression Calculation Functions ---

// Calculate basic statistics needed for regressions
function calculateStats(data) {
    const n = data.length;
    if (n === 0) return { n: 0 };

    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    let sumSqDiffX = 0;
    let sumSqDiffY = 0;
    let sumProdDiff = 0;

    data.forEach(d => {
        const diffX = d.x - meanX;
        const diffY = d.y - meanY;
        sumSqDiffX += diffX * diffX;
        sumSqDiffY += diffY * diffY;
        sumProdDiff += diffX * diffY;
    });

    const Sxx = sumSqDiffX; // Sum of squares XX
    const Syy = sumSqDiffY; // Sum of squares YY
    const Sxy = sumProdDiff; // Sum of products XY

    // Using population variance/covariance (divide by n)
    const varX = Sxx / n;
    const varY = Syy / n;
    const covXY = Sxy / n;

    return { n, meanX, meanY, varX, varY, covXY, Sxx, Syy, Sxy };
}

// Calculate Y on X regression (Standard OLS)
function calculateYonX(stats) {
    if (!stats || stats.n < 2 || stats.varX === 0) {
        // Handle insufficient data or vertical data (infinite slope case conceptually)
        return { slope: stats.varX === 0 ? Infinity : NaN, intercept: NaN };
    }
    const slope = stats.covXY / stats.varX; // b_yx = Sxy / Sxx
    const intercept = stats.meanY - slope * stats.meanX;
    return { slope, intercept };
}

// Calculate X on Y regression
function calculateXonY(stats) {
     if (!stats || stats.n < 2 || stats.varY === 0) {
         // Handle insufficient data or horizontal data
         // If varY is 0, original XonY line is vertical (x = meanX)
         // We need to return params for y = mx + c format
         return { slope: 0, intercept: stats.varY === 0 ? stats.meanY : NaN };
     }
     // Calculate slope for x = m*y + c
     const slope_xy = stats.covXY / stats.varY; // b_xy = Sxy / Syy
     const intercept_xy = stats.meanX - slope_xy * stats.meanY;

     // Convert x = slope_xy * y + intercept_xy  TO  y = slope * x + intercept
     if (Math.abs(slope_xy) < 1e-9) { // Original line is vertical (x = intercept_xy)
         return { slope: Infinity, intercept: intercept_xy };
     } else {
         const slope = 1 / slope_xy;
         const intercept = -intercept_xy / slope_xy;
         return { slope, intercept };
     }
}

// Calculate Orthogonal Regression (Total Least Squares / PCA line)
function calculateOrthogonal(stats) {
    if (!stats || stats.n < 2) {
        return { slope: NaN, intercept: NaN };
    }
    const { meanX, meanY, Sxx, Syy, Sxy } = stats;

    // Handle cases with zero variance or covariance
    if (Math.abs(Sxy) < 1e-9) { // No correlation or perfectly horizontal/vertical
        if (Syy >= Sxx) { // More variance in Y (or equal) -> vertical line is best fit
             return { slope: Infinity, intercept: meanX };
        } else { // More variance in X -> horizontal line is best fit
             return { slope: 0, intercept: meanY };
        }
    }

    // Standard formula for orthogonal slope
    const diff_yy_xx = Syy - Sxx;
    const sqrt_term = Math.sqrt(diff_yy_xx * diff_yy_xx + 4 * Sxy * Sxy);
    const slope = (diff_yy_xx + sqrt_term) / (2 * Sxy);

    const intercept = meanY - slope * meanX;
    return { slope, intercept };
}

// --- D3 Setup and Drawing ---

function setupChart() {
    const container = document.getElementById('chart-container');
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    innerWidth = width - margin.left - margin.right; // Store globally
    innerHeight = height - margin.top - margin.bottom; // Store globally

    d3.select('#chart').selectAll('*').remove();

    svg = d3.select('#chart')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    xScale = d3.scaleLinear().domain(CONFIG.xRange).range([0, innerWidth]);
    yScale = d3.scaleLinear().domain(CONFIG.yRange).range([innerHeight, 0]);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);
    svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0, ${innerHeight})`).call(xAxis);
    svg.append('g').attr('class', 'y-axis').call(yAxis);

    lineGenerator = d3.line().x(d => d.x).y(d => d.y);

    // Initialize user line handles
    const midY = innerHeight / 2;
    userLineHandles = [ { x: 0, y: midY }, { x: innerWidth, y: midY } ];
    userLineParams = calculateLineParams(userLineHandles[0], userLineHandles[1]);

    const drag = d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);

    // Draw initial user line and handles
    svg.append('path').datum(userLineHandles).attr('class', 'user-line').attr('d', lineGenerator);
    svg.selectAll('.handle').data(userLineHandles).enter().append('circle')
        .attr('class', 'handle').attr('r', CONFIG.handleRadius)
        .attr('cx', d => d.x).attr('cy', d => d.y).call(drag);

     // Add a group for calculated lines to easily remove them later
    svg.append('g').attr('class', 'calculated-lines-group');
}

function drawData(data, className) {
    if (!xScale || !yScale) return;
    const dataGroup = svg.append('g').attr('class', className + '-group');
    dataGroup.selectAll('.' + className)
        .data(data)
        .enter()
        .append('circle')
        .attr('class', className)
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 4);
}

// --- NEW: Function to Draw Calculated Lines ---
function drawCalculatedLine(params, lineClass) {
    const { slope, intercept } = params;
    if (!isFinite(slope)) { // Handle vertical lines
        if (isFinite(intercept)) { // Intercept here is the x-value for the vertical line
             const xPixel = xScale(intercept);
             if (xPixel >= 0 && xPixel <= innerWidth) { // Only draw if within x-bounds
                 svg.select('.calculated-lines-group')
                    .append('line')
                    .attr('class', `calculated-line ${lineClass}`)
                    .attr('x1', xPixel)
                    .attr('y1', 0)
                    .attr('x2', xPixel)
                    .attr('y2', innerHeight);
             }
        }
        return; // Don't draw if slope or intercept is NaN/undefined
    }

    // Calculate endpoints in data coordinates based on x-range
    const x0 = CONFIG.xRange[0];
    const y0 = slope * x0 + intercept;
    const x1 = CONFIG.xRange[1];
    const y1 = slope * x1 + intercept;

    // Convert endpoints to pixel coordinates
    const lineDataPixels = [
        { x: xScale(x0), y: yScale(y0) },
        { x: xScale(x1), y: yScale(y1) }
    ];

    // Draw the line using the line generator
    svg.select('.calculated-lines-group') // Append to the dedicated group
       .append('path')
       .datum(lineDataPixels)
       .attr('class', `calculated-line ${lineClass}`)
       .attr('d', lineGenerator);
}


function updateLine() {
    userLineParams = calculateLineParams(userLineHandles[0], userLineHandles[1]);
    svg.select('.user-line').datum(userLineHandles).attr('d', lineGenerator);
    svg.selectAll('.handle').data(userLineHandles).attr('cx', d => d.x).attr('cy', d => d.y);
}

// --- Drag Handlers (Modified slightly) ---
let activeHandleIndex = -1;

function dragstarted(event, d) {
    d3.select(this).raise().attr('stroke', 'black');
    activeHandleIndex = userLineHandles.indexOf(d);
}

function dragged(event, d) {
    if (activeHandleIndex !== -1) {
        const newX = Math.max(0, Math.min(innerWidth, event.x)); // Use innerWidth
        const newY = Math.max(0, Math.min(innerHeight, event.y)); // Use innerHeight
        userLineHandles[activeHandleIndex] = { x: newX, y: newY };
        d3.select(this).attr('cx', newX).attr('cy', newY);
        updateLine();
    }
    if (isTested) {
        resetTestView(); // Reset test view if user adjusts line after testing
    }
}

function dragended(event, d) {
    d3.select(this).attr('stroke', 'darkred');
    activeHandleIndex = -1;
}

// --- Button Actions ---

function runTest() {
    if (isTested) return; // Don't re-run if already tested

    if (!testData || testData.length === 0) {
        testData = generateData(CONFIG.numTestPoints, CONFIG.trueSlope, CONFIG.trueIntercept, CONFIG.noiseStdDev, CONFIG.xRange);
    }
    svg.selectAll('.data-point-train').style('opacity', 0.2);
    drawData(testData, 'data-point-test');
    const mse = calculateMSE(testData, userLineParams.slope, userLineParams.intercept);
    document.getElementById('score').textContent = `MSE: ${mse.toFixed(2)}`;
    document.getElementById('score-feedback').textContent = getScoreFeedback(mse);
    isTested = true;
}

function resetTestView() {
    svg.selectAll('.data-point-test-group').remove();
    svg.selectAll('.data-point-train').style('opacity', 0.7);
    document.getElementById('score').textContent = 'MSE: ---';
    document.getElementById('score-feedback').textContent = '';
    isTested = false;
    testData = []; // Clear test data so it regenerates if needed
}

// --- NEW: Action for Clearing Calculated Lines ---
function clearCalculatedLines() {
    svg.select('.calculated-lines-group').selectAll('*').remove();
}


function resetApp() {
    isTested = false;
    testData = [];
    document.getElementById('score').textContent = 'MSE: ---';
    document.getElementById('score-feedback').textContent = '';
    trainData = generateData(CONFIG.numTrainPoints, CONFIG.trueSlope, CONFIG.trueIntercept, CONFIG.noiseStdDev, CONFIG.xRange);
    setupChart(); // This now also adds the empty .calculated-lines-group
    drawData(trainData, 'data-point-train');
    // Note: setupChart implicitly clears old calculated lines by removing the whole SVG content
}


// --- Initialization ---

// Test/Reset Buttons
document.getElementById('test-button').addEventListener('click', runTest);
document.getElementById('reset-button').addEventListener('click', resetApp);

// --- NEW: Calculated Line Button Listeners ---
document.getElementById('show-y-on-x').addEventListener('click', () => {
    const stats = calculateStats(trainData);
    const params = calculateYonX(stats);
    drawCalculatedLine(params, 'line-y-on-x');
});

document.getElementById('show-x-on-y').addEventListener('click', () => {
    const stats = calculateStats(trainData);
    const params = calculateXonY(stats);
    drawCalculatedLine(params, 'line-x-on-y');
});

document.getElementById('show-orthogonal').addEventListener('click', () => {
    const stats = calculateStats(trainData);
    const params = calculateOrthogonal(stats);
    drawCalculatedLine(params, 'line-orthogonal');
});

document.getElementById('clear-calc-lines').addEventListener('click', clearCalculatedLines);


// Initial setup on page load
resetApp();