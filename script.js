// קובץ script.js - חלק 1/2

const svg = d3.select("#chart");
const g = svg.append("g");

let zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

svg.call(zoom);

let nodes = [];
let links = [];
let nodeGroup = g.append("g");
let linkGroup = g.append("g");
let isCtrlPressed = false;
let isAddingArrow = false;
let newArrow = { source: null, target: null };
let selectedObjects = [];
let currentEditNode = null;

document.addEventListener('keydown', (event) => {
    if (event.key === 'Control') isCtrlPressed = true;
    if (event.key === 'Delete') deleteSelectedObjects();
});

document.addEventListener('keyup', (event) => {
    if (event.key === 'Control') isCtrlPressed = false;
});

function updateChart() {
    updateLinks();
    updateNodes();
}

function updateLinks() {
    let link = linkGroup.selectAll(".link-group")
        .data(links, d => d.id);

    let linkEnter = link.enter().append("g")
        .attr("class", "link-group");

    linkEnter.append("path")
        .attr("class", "link")
        .attr("marker-end", "url(#arrowhead)");

    linkEnter.append("circle")
        .attr("class", "link-handle source-handle")
        .attr("r", 5)
        .call(d3.drag()
            .on("start", dragLinkHandleStarted)
            .on("drag", (event, d) => dragLinkHandle(event, d, 'source'))
            .on("end", dragLinkHandleEnded));

    linkEnter.append("circle")
        .attr("class", "link-handle target-handle")
        .attr("r", 5)
        .call(d3.drag()
            .on("start", dragLinkHandleStarted)
            .on("drag", (event, d) => dragLinkHandle(event, d, 'target'))
            .on("end", dragLinkHandleEnded));

    linkEnter.append("circle")
        .attr("class", "link-delete")
        .attr("r", 8)
        .on("click", deleteLinkOnClick);

    let linkUpdate = linkEnter.merge(link);

    linkUpdate.select("path")
        .attr("d", d => {
            const sourcePoint = d.sourceNode && d.isSourceAnchored ? getNodeAnchorPoint(d.sourceNode, d.sourceAnchor) : d.source;
            const targetPoint = d.targetNode && d.isTargetAnchored ? getNodeAnchorPoint(d.targetNode, d.targetAnchor) : d.target;
            return `M${sourcePoint.x},${sourcePoint.y}L${targetPoint.x},${targetPoint.y}`;
        })
        .attr("class", d => `link ${d.isSourceAnchored && d.isTargetAnchored ? 'anchored' : ''} ${selectedObjects.includes(d) ? 'selected' : ''}`);

    linkUpdate.select(".source-handle")
        .attr("cx", d => d.source.x)
        .attr("cy", d => d.source.y);

    linkUpdate.select(".target-handle")
        .attr("cx", d => d.target.x)
        .attr("cy", d => d.target.y);

    linkUpdate.select(".link-delete")
        .attr("cx", d => (d.source.x + d.target.x) / 2)
        .attr("cy", d => (d.source.y + d.target.y) / 2);

    linkUpdate.on("click", (event, d) => toggleSelection(event, d));

    link.exit().remove();
}

function updateNodes() {
    let node = nodeGroup.selectAll(".node")
        .data(nodes, d => d.id);

    let nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("id", d => `node-${d.id}`)
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    nodeEnter.each(function(d) {
        const group = d3.select(this);
        appendShape(group, d);
        appendAnchorPoints(group, d);
        appendForeignObject(group, d);
        appendEditButton(group, d);
    });

    let nodeUpdate = nodeEnter.merge(node);

    nodeUpdate.attr("transform", d => `translate(${d.x},${d.y})`)
        .on("click", (event, d) => toggleSelection(event, d));

    nodeUpdate.select("rect, circle, path")
        .attr("fill", d => d.color)
        .attr("class", d => selectedObjects.includes(d) ? "selected" : "");

    nodeUpdate.each(function(d) {
        updateNodeShape(d3.select(this), d);
    });

    node.exit().remove();
}

// קובץ script.js - חלק 2/2

function appendShape(group, d) {
    switch(d.shape) {
        case 'rect':
            group.append("rect")
                .attr("width", d => d.width)
                .attr("height", d => d.height)
                .attr("rx", 5)
                .attr("ry", 5);
            break;
        case 'circle':
            group.append("circle")
                .attr("r", d => Math.min(d.width, d.height) / 2);
            break;
        case 'star':
            const starPath = d3.symbol().type(d3.symbolStar).size(d => d.width * d.height * 0.8);
            group.append("path")
                .attr("d", starPath)
                .attr("transform", d => `translate(${d.width/2},${d.height/2})`);
            break;
        case 'square':
            group.append("rect")
                .attr("width", d => Math.min(d.width, d.height))
                .attr("height", d => Math.min(d.width, d.height));
            break;
    }
}

function appendAnchorPoints(group, d) {
    const anchorPositions = getAnchorPositions(d);
    anchorPositions.forEach((pos) => {
        group.append("circle")
            .attr("class", "anchor-point")
            .attr("cx", pos.x)
            .attr("cy", pos.y)
            .attr("r", 3)
            .attr("data-anchor", pos.name);
    });
}

function getAnchorPositions(node) {
    const positions = [];
    const width = node.width;
    const height = node.height;

    switch(node.shape) {
        case 'rect':
        case 'square':
            positions.push(
                {name: 'top', x: width / 2, y: 0},
                {name: 'right', x: width, y: height / 2},
                {name: 'bottom', x: width / 2, y: height},
                {name: 'left', x: 0, y: height / 2},
                {name: 'topLeft', x: 0, y: 0},
                {name: 'topRight', x: width, y: 0},
                {name: 'bottomLeft', x: 0, y: height},
                {name: 'bottomRight', x: width, y: height}
            );
            break;
        case 'circle':
            const radius = Math.min(width, height) / 2;
            const centerX = width / 2;
            const centerY = height / 2;
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI / 4);
                positions.push({
                    name: `point${i}`,
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
                });
            }
            break;
        case 'star':
            const starRadius = Math.min(width, height) / 2;
            const starCenterX = width / 2;
            const starCenterY = height / 2;
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
                positions.push({
                    name: `point${i}`,
                    x: starCenterX + starRadius * 0.8 * Math.cos(angle),
                    y: starCenterY + starRadius * 0.8 * Math.sin(angle)
                });
            }
            break;
    }
    return positions;
}

function appendForeignObject(group, d) {
    const fo = group.append("foreignObject")
        .attr("width", d.width)
        .attr("height", d.height)
        .attr("x", d.shape === 'circle' ? -d.width / 2 : 0)
        .attr("y", d.shape === 'circle' ? -d.height / 2 : 0);

    const div = fo.append("xhtml:div")
        .attr("class", "node-text")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("text-align", "center")
        .style("padding", "5px")
        .style("box-sizing", "border-box");

    div.append("span")
        .text(d.label)
        .style("word-break", "break-word");

    adaptTextSize(div, d);
}

function adaptTextSize(textElement, d) {
    let fontSize = Math.min(d.width, d.height) / 5;
    textElement.style("font-size", `${fontSize}px`);

    const span = textElement.select("span").node();
    while (span.offsetWidth > d.width - 10 || span.offsetHeight > d.height - 10) {
        fontSize *= 0.9;
        textElement.style("font-size", `${fontSize}px`);
        if (fontSize < 8) break;
    }
}

function appendEditButton(group, d) {
    const editButton = group.append("g")
        .attr("class", "edit-button")
        .attr("transform", `translate(${d.width - 20}, ${d.height - 20})`)
        .on("click", (event) => {
            event.stopPropagation();
            editNodeLabel(d);
        });

    editButton.append("circle")
        .attr("r", 8)
        .attr("fill", "#f39c12");

    editButton.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .text("✎");
}

function updateNodeShape(node, d) {
    switch(d.shape) {
        case 'rect':
        case 'square':
            node.select("rect")
                .attr("width", d.width)
                .attr("height", d.height);
            break;
        case 'circle':
            node.select("circle")
                .attr("r", Math.min(d.width, d.height) / 2);
            break;
        case 'star':
            const starPath = d3.symbol().type(d3.symbolStar).size(d.width * d.height * 0.8);
            node.select("path")
                .attr("d", starPath)
                .attr("transform", `translate(${d.width/2},${d.height/2})`);
            break;
    }
    node.select("foreignObject")
        .attr("width", d.width)
        .attr("height", d.height)
        .attr("x", d.shape === 'circle' ? -d.width / 2 : 0)
        .attr("y", d.shape === 'circle' ? -d.height / 2 : 0);
    
    node.select(".node-text span")
        .text(d.label);
    
    adaptTextSize(node.select(".node-text"), d);
    
    node.selectAll(".anchor-point").remove();
    appendAnchorPoints(node, d);
}

function editNodeLabel(node) {
    currentEditNode = node;
    const editModal = d3.select("#editModal");
    editModal.select("#editNodeLabel").property("value", node.label);
    editModal.style("display", "block");
}

function dragstarted(event, d) {
    d3.select(this).raise().classed("active", true);
}

function dragged(event, d) {
    d.x = event.x;
    d.y = event.y;
    updateNodeLinks(d);
    d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
}

function dragended(event, d) {
    d3.select(this).classed("active", false);
    updateChart();
}

function updateNodeLinks(node) {
    links.forEach(link => {
        if (link.sourceNode && link.sourceNode.id === node.id && link.isSourceAnchored) {
            const anchorPoint = getNodeAnchorPoint(node, link.sourceAnchor);
            link.source = { x: anchorPoint.x, y: anchorPoint.y };
        }
        if (link.targetNode && link.targetNode.id === node.id && link.isTargetAnchored) {
            const anchorPoint = getNodeAnchorPoint(node, link.targetAnchor);
            link.target = { x: anchorPoint.x, y: anchorPoint.y };
        }
    });
}

function dragLinkHandleStarted(event, d) {
    d3.select(this).raise().classed("active", true);
}

function dragLinkHandle(event, d, handleType) {
    if (handleType === 'source') {
        if (!d.isSourceAnchored) {
            d.source.x = event.x;
            d.source.y = event.y;
        }
    } else {
        if (!d.isTargetAnchored) {
            d.target.x = event.x;
            d.target.y = event.y;
        }
    }
    updateChart();
}

function dragLinkHandleEnded(event, d) {
    d3.select(this).classed("active", false);
    const sourceNode = findClosestNode(d.source.x, d.source.y);
    const targetNode = findClosestNode(d.target.x, d.target.y);
    
    if (sourceNode && isPointNearNodeAnchor(sourceNode, d.source.x, d.source.y)) {
        d.sourceNode = sourceNode;
        d.sourceAnchor = findClosestAnchor(sourceNode, d.source);
        d.isSourceAnchored = true;
    } else {
        d.sourceNode = null;
        d.isSourceAnchored = false;
    }
    
    if (targetNode && isPointNearNodeAnchor(targetNode, d.target.x, d.target.y)) {
        d.targetNode = targetNode;
        d.targetAnchor = findClosestAnchor(targetNode, d.target);
        d.isTargetAnchored = true;
    } else {
        d.targetNode = null;
        d.isTargetAnchored = false;
    }
    updateChart();
}

function deleteLinkOnClick(event, d) {
    event.stopPropagation();
    links = links.filter(l => l.id !== d.id);
    updateChart();
}

function toggleSelection(event, d) {
    event.stopPropagation();
    if (!isCtrlPressed) {
        selectedObjects = [];
    }
    const index = selectedObjects.indexOf(d);
    if (index > -1) {
        selectedObjects.splice(index, 1);
    } else {
        selectedObjects.push(d);
    }
    updateChart();
}

function deleteSelectedObjects() {
    if (selectedObjects.length > 0) {
        nodes = nodes.filter(n => !selectedObjects.includes(n));
        links = links.filter(l => !selectedObjects.includes(l));
        selectedObjects = [];
        updateChart();
    }
}

function findClosestNode(x, y) {
    return nodes.reduce((closest, node) => {
        const dx = node.x + node.width / 2 - x;
        const dy = node.y + node.height / 2 - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < closest.distance ? { node, distance } : closest;
    }, { node: null, distance: Infinity }).node;
}

function isPointNearNodeAnchor(node, x, y) {
    const anchorPoints = getAnchorPositions(node);
    return anchorPoints.some(point => {
        const dx = node.x + point.x - x;
        const dy = node.y + point.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 10;
    });
}

function findClosestAnchor(node, point) {
    const anchorPoints = getAnchorPositions(node);
    return anchorPoints.reduce((closest, anchor) => {
        const dx = node.x + anchor.x - point.x;
        const dy = node.y + anchor.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < closest.distance ? { anchor: anchor.name, distance } : closest;
    }, { anchor: null, distance: Infinity }).anchor;
}

function getNodeAnchorPoint(node, anchor) {
    const anchorPositions = getAnchorPositions(node);
    const position = anchorPositions.find(pos => pos.name === anchor);
    return position ? { x: node.x + position.x, y: node.y + position.y } : null;
}

function showAddNodeModal() {
    d3.select("#modal").style("display", "block");
}

function toggleAddArrowMode() {
    isAddingArrow = !isAddingArrow;
    if (isAddingArrow) {
        svg.style("cursor", "crosshair");
        d3.select("#addArrow").text("בטל הוספת חץ");
    } else {
        svg.style("cursor", "default");
        d3.select("#addArrow").text("הוסף חץ");
        newArrow = { source: null, target: null };
    }
}

function saveChartData() {
    const chartData = { nodes: nodes, links: links };
    const jsonString = JSON.stringify(chartData);
    const blob = new Blob([jsonString], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "flowchart.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function loadChartData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            const loadedData = JSON.parse(event.target.result);
            nodes = loadedData.nodes;
            links = loadedData.links;
            updateChart();
        };
        reader.readAsText(file);
    });
    input.click();
}

// המשך מהחלק הקודם...

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'pt', 'a4');

    html2canvas(document.getElementById("chartContainer")).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        doc.save("flowchart.pdf");
    });
}

svg.on("click", function(event) {
    if (isAddingArrow) {
        let [x, y] = d3.pointer(event, g.node());
        if (!newArrow.source) {
            newArrow.source = { x, y };
        } else {
            newArrow.target = { x, y };
            
            const sourceNode = findClosestNode(newArrow.source.x, newArrow.source.y);
            const targetNode = findClosestNode(newArrow.target.x, newArrow.target.y);
            
            const newLink = { 
                id: Date.now(),
                source: newArrow.source,
                target: newArrow.target,
                isSourceAnchored: false,
                isTargetAnchored: false
            };

            if (sourceNode && isPointNearNodeAnchor(sourceNode, newArrow.source.x, newArrow.source.y)) {
                newLink.sourceNode = sourceNode;
                newLink.sourceAnchor = findClosestAnchor(sourceNode, newLink.source);
                newLink.isSourceAnchored = true;
            }

            if (targetNode && isPointNearNodeAnchor(targetNode, newArrow.target.x, newArrow.target.y)) {
                newLink.targetNode = targetNode;
                newLink.targetAnchor = findClosestAnchor(targetNode, newLink.target);
                newLink.isTargetAnchored = true;
            }

            links.push(newLink);
            updateChart();
            newArrow = { source: null, target: null };
            isAddingArrow = false;
            svg.style("cursor", "default");
            d3.select("#addArrow").text("הוסף חץ");
        }
    } else if (!isCtrlPressed) {
        selectedObjects = [];
        updateChart();
    }
});

function initializeUI() {
    d3.select("#addNode").on("click", showAddNodeModal);
    d3.select("#addArrow").on("click", toggleAddArrowMode);
    d3.select("#deleteSelected").on("click", deleteSelectedObjects);
    d3.select("#zoomIn").on("click", () => zoom.scaleBy(svg.transition().duration(750), 1.2));
    d3.select("#zoomOut").on("click", () => zoom.scaleBy(svg.transition().duration(750), 0.8));
    d3.select("#saveChart").on("click", saveChartData);
    d3.select("#loadChart").on("click", loadChartData);
    d3.select("#exportPDF").on("click", exportToPDF);

    d3.select("#toggleSideMenu").on("click", function() {
        d3.select("#side-menu").classed("open", function(d, i, nodes) {
            return !d3.select(this).classed("open");
        });
    });

    const modal = d3.select("#modal");
    d3.select("#saveNode").on("click", () => {
        let label = d3.select("#nodeLabel").property("value");
        let color = d3.select("#nodeColor").property("value");
        let shape = d3.select("#nodeShape").property("value");
        let size = parseInt(d3.select("#nodeSize").property("value"));
        if (label) {
            let newId = nodes.length ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
            let newNode = { 
                id: newId, 
                label: label, 
                x: 100, 
                y: 100, 
                color: color,
                shape: shape,
                width: shape === 'circle' ? size : size,
                height: shape === 'circle' ? size : size / 2
            };
            nodes.push(newNode);
            updateChart();
            modal.style("display", "none");
            d3.select("#nodeLabel").property("value", "");
        }
    });
    d3.select("#cancelNode").on("click", () => {
        modal.style("display", "none");
        d3.select("#nodeLabel").property("value", "");
    });

    const editModal = d3.select("#editModal");
    editModal.select(".save-button").on("click", function() {
        const newLabel = editModal.select("#editNodeLabel").property("value").trim();
        if (newLabel !== "" && currentEditNode) {
            currentEditNode.label = newLabel;
            updateNodeShape(d3.select(`#node-${currentEditNode.id}`), currentEditNode);
            updateChart();
        }
        editModal.style("display", "none");
    });
    editModal.select(".cancel-button").on("click", function() {
        editModal.style("display", "none");
    });
}

function initializeToolbar() {
    const toolbar = d3.select('.vertical-toolbar');
    const chartContainer = d3.select('#chartContainer');
    const toggleButton = d3.select('#toggleToolbar');

    toggleButton.on('click', () => {
        toolbar.classed('expanded', !toolbar.classed('expanded'));
        chartContainer.classed('toolbar-expanded', !chartContainer.classed('toolbar-expanded'));
    });
}

svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "-0 -5 10 10")
    .attr("refX", 20)
    .attr("refY", 0)
    .attr("orient", "auto")
    .attr("markerWidth", 8)
    .attr("markerHeight", 8)
    .attr("xoverflow", "visible")
    .append("svg:path")
    .attr("d", "M 0,-5 L 10 ,0 L 0,5")
    .attr("fill", "#4682B4")
    .style("stroke", "none");

// אתחול הממשק והתרשים
initializeUI();
initializeToolbar();
updateChart();