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

// --- Utility Functions ---

// Gaussian noise generator (Box-Muller transform)
function gaussianRandom(mean = 0, stdev = 1) {
    let u = 1 - Math.random(); // Converting [0,1) to (0,1]
    let v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Transform to desired mean and standard deviation:
    return z * stdev + mean;
}

// Generate data points
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

// Calculate line parameters (slope, intercept) from two handles (pixel coords)
function calculateLineParams(handle1_px, handle2_px) {
    // Convert pixel coords to data coords
    const p1 = { x: xScale.invert(handle1_px.x), y: yScale.invert(handle1_px.y) };
    const p2 = { x: xScale.invert(handle2_px.x), y: yScale.invert(handle2_px.y) };

    if (Math.abs(p1.x - p2.x) < 1e-6) { // Avoid division by zero for vertical lines
        return { slope: Infinity, intercept: p1.x }; // Or handle as needed
    }

    const slope = (p2.y - p1.y) / (p2.x - p1.x);
    const intercept = p1.y - slope * p1.x;
    return { slope, intercept };
}

// Calculate Mean Squared Error
function calculateMSE(data, slope, intercept) {
    if (!data || data.length === 0 || !isFinite(slope)) return Infinity;
    let sumSquaredError = 0;
    data.forEach(d => {
        const yPred = slope * d.x + intercept;
        sumSquaredError += Math.pow(d.y - yPred, 2);
    });
    return sumSquaredError / data.length;
}

// Provide qualitative feedback based on MSE
function getScoreFeedback(mse) {
    if (mse === Infinity) return "Hmm, the line seems vertical?";
    if (mse < 50) return "Excellent fit!";
    if (mse < 150) return "Great job!";
    if (mse < 400) return "Good fit!";
    if (mse < 1000) return "Not bad, try adjusting!";
    return "Keep trying to improve the fit!";
}


// --- D3 Setup and Drawing ---

function setupChart() {
    const container = document.getElementById('chart-container');
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Remove previous SVG if resetting
    d3.select('#chart').selectAll('*').remove();

    svg = d3.select('#chart')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    xScale = d3.scaleLinear().domain(CONFIG.xRange).range([0, innerWidth]);
    yScale = d3.scaleLinear().domain(CONFIG.yRange).range([innerHeight, 0]); // Flipped for SVG coords

    // Axes (optional but good)
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);
    svg.append('g')
       .attr('class', 'x-axis')
       .attr('transform', `translate(0, ${innerHeight})`)
       .call(xAxis);
    svg.append('g')
       .attr('class', 'y-axis')
       .call(yAxis);

    // Line generator
    lineGenerator = d3.line()
        .x(d => d.x) // These will be pixel coords
        .y(d => d.y);

    // Initialize line handles (e.g., horizontal line in the middle)
    const midY = innerHeight / 2;
    userLineHandles = [
        { x: 0, y: midY },
        { x: innerWidth, y: midY }
    ];

    // Calculate initial user line params
    userLineParams = calculateLineParams(userLineHandles[0], userLineHandles[1]);

    // Drag behavior for handles
    const drag = d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);

    // Draw initial user line
    svg.append('path')
        .datum(userLineHandles)
        .attr('class', 'user-line')
        .attr('d', lineGenerator);

    // Draw handles
    svg.selectAll('.handle')
        .data(userLineHandles)
        .enter()
        .append('circle')
        .attr('class', 'handle')
        .attr('r', CONFIG.handleRadius)
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .call(drag); // Apply drag behavior
}

function drawData(data, className) {
    // Ensure scales are defined
    if (!xScale || !yScale) {
        console.error("Scales not initialized!");
        return;
    }

    const dataGroup = svg.append('g').attr('class', className + '-group'); // Group points

    dataGroup.selectAll('.' + className)
        .data(data)
        .enter()
        .append('circle')
        .attr('class', className)
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 4); // Point radius
}

function updateLine() {
    // Recalculate params based on handle positions
    userLineParams = calculateLineParams(userLineHandles[0], userLineHandles[1]);

    // Update the line path
    svg.select('.user-line')
        .datum(userLineHandles)
        .attr('d', lineGenerator);

    // Update handle positions visually (redundant if drag updates them, but safe)
    svg.selectAll('.handle')
        .data(userLineHandles)
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
}

// --- Drag Handlers ---
let activeHandleIndex = -1;

function dragstarted(event, d) {
    d3.select(this).raise().attr('stroke', 'black'); // Bring handle to front
    // Identify which handle is being dragged (0 or 1)
    activeHandleIndex = userLineHandles.indexOf(d);
}

function dragged(event, d) {
    // Update the position of the dragged handle
    if (activeHandleIndex !== -1) {
        const newX = Math.max(0, Math.min(xScale.range()[1], event.x)); // Clamp within chart bounds
        const newY = Math.max(0, Math.min(yScale.range()[0], event.y)); // Clamp within chart bounds
        userLineHandles[activeHandleIndex] = { x: newX, y: newY };
        d3.select(this).attr('cx', newX).attr('cy', newY);
        updateLine(); // Redraw the line based on new handle position
    }
     // Reset test state if user modifies line after testing
    if (isTested) {
        resetTestView();
    }
}

function dragended(event, d) {
    d3.select(this).attr('stroke', 'darkred'); // Reset handle stroke
    activeHandleIndex = -1;
}

// --- Button Actions ---

function runTest() {
    if (!testData || testData.length === 0) {
        testData = generateData(CONFIG.numTestPoints, CONFIG.trueSlope, CONFIG.trueIntercept, CONFIG.noiseStdDev, CONFIG.xRange);
    }

    // Grey out training data
    svg.selectAll('.data-point-train').style('opacity', 0.2);

    // Draw test data
    drawData(testData, 'data-point-test');

    // Calculate MSE on test data using the user's current line
    const mse = calculateMSE(testData, userLineParams.slope, userLineParams.intercept);

    // Display score
    document.getElementById('score').textContent = `MSE: ${mse.toFixed(2)}`;
    document.getElementById('score-feedback').textContent = getScoreFeedback(mse);
    isTested = true;
}

function resetTestView() {
     // Remove test points
    svg.selectAll('.data-point-test-group').remove();
    // Restore training data opacity
    svg.selectAll('.data-point-train').style('opacity', 0.7);
    // Clear score
    document.getElementById('score').textContent = 'MSE: ---';
    document.getElementById('score-feedback').textContent = '';
    isTested = false;
}


function resetApp() {
    isTested = false;
    testData = []; // Clear test data for regeneration

    // Clear score
    document.getElementById('score').textContent = 'MSE: ---';
    document.getElementById('score-feedback').textContent = '';

    // Regenerate training data
    trainData = generateData(CONFIG.numTrainPoints, CONFIG.trueSlope, CONFIG.trueIntercept, CONFIG.noiseStdDev, CONFIG.xRange);

    // Redraw everything
    setupChart(); // Re-initializes scales, axes, line, handles
    drawData(trainData, 'data-point-train'); // Draw new training data
}


// --- Initialization ---

document.getElementById('test-button').addEventListener('click', runTest);
document.getElementById('reset-button').addEventListener('click', resetApp);

// Initial setup on page load
resetApp();