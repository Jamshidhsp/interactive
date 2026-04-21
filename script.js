const DATA_PATH = "./data/umap_data.json";

const GROUP_STYLE = {
  Real: { color: "#2563eb", label: "Real cells", markerSize: 5.5, opacity: 0.55, symbol: "circle" },
  "Baseline predicted": {
    color: "#dc2626",
    label: "Baseline predicted",
    markerSize: 5,
    opacity: 0.45,
    symbol: "circle",
  },
  "Ours (st_vae) predicted": {
    color: "#16a34a",
    label: "Our model predicted",
    markerSize: 5,
    opacity: 0.52,
    symbol: "circle",
  },
};

const STATE = {
  points: [],
  perturbations: [],
  cellTypes: [],
};

const ui = {
  perturbationSelect: document.getElementById("perturbationSelect"),
  cellTypeSelect: document.getElementById("cellTypeSelect"),
  searchInput: document.getElementById("searchInput"),
  viewModeSelect: document.getElementById("viewModeSelect"),
  toggleReal: document.getElementById("toggleReal"),
  toggleBaseline: document.getElementById("toggleBaseline"),
  toggleOurs: document.getElementById("toggleOurs"),
  toggleCentroidArrows: document.getElementById("toggleCentroidArrows"),
  plot: document.getElementById("plot"),
  status: document.getElementById("status"),
};

function safeText(value) {
  if (value === null || value === undefined || value === "") return "unknown";
  return String(value);
}

function shortText(value, maxLen = 28) {
  const s = safeText(value);
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}...` : s;
}

function toOption(value, label = value) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function populateSelect(selectEl, values, allLabel) {
  selectEl.innerHTML = "";
  selectEl.appendChild(toOption("__ALL__", allLabel));
  values.forEach((v) => selectEl.appendChild(toOption(v)));
}

function getCentroid(points) {
  if (!points.length) return null;
  let sx = 0;
  let sy = 0;
  points.forEach((p) => {
    sx += p.umap1;
    sy += p.umap2;
  });
  return { x: sx / points.length, y: sy / points.length };
}

function selectedGroupVisibility() {
  return {
    Real: ui.toggleReal.checked,
    "Baseline predicted": ui.toggleBaseline.checked,
    "Ours (st_vae) predicted": ui.toggleOurs.checked,
  };
}

function filteredPoints() {
  const selectedPert = ui.perturbationSelect.value;
  const selectedCellType = ui.cellTypeSelect.value;
  const q = ui.searchInput.value.trim().toLowerCase();
  const isFocus = ui.viewModeSelect.value === "focus";

  return STATE.points.filter((p) => {
    if (selectedPert !== "__ALL__" && p.perturbation !== selectedPert) return false;
    if (selectedCellType !== "__ALL__" && p.cell_type !== selectedCellType) return false;
    if (q && !p.perturbation.toLowerCase().includes(q)) return false;
    if (isFocus && selectedPert === "__ALL__") return false;
    return true;
  });
}

function buildTrace(points, groupName) {
  const style = GROUP_STYLE[groupName];
  const groupPoints = points.filter((p) => p.group === groupName);
  if (!groupPoints.length) return null;

  return {
    type: "scattergl",
    mode: "markers",
    name: style.label,
    marker: {
      color: style.color,
      size: style.markerSize,
      opacity: style.opacity,
      symbol: style.symbol,
    },
    x: groupPoints.map((p) => p.umap1),
    y: groupPoints.map((p) => p.umap2),
    customdata: groupPoints.map((p) => [p.perturbation, p.cell_type, p.cell_id]),
    hovertemplate:
      "Pert: %{customdata[0]}<br>" +
      "Type: %{customdata[1]}<br>" +
      "Cell: %{customdata[2]}<br>" +
      "<extra>" +
      style.label +
      "</extra>",
  };
}

function buildCentroidAnnotations(points) {
  const selectedPert = ui.perturbationSelect.value;
  if (ui.viewModeSelect.value !== "focus" || selectedPert === "__ALL__" || !ui.toggleCentroidArrows.checked) {
    return [];
  }

  const realPts = points.filter((p) => p.group === "Real");
  const baselinePts = points.filter((p) => p.group === "Baseline predicted");
  const oursPts = points.filter((p) => p.group === "Ours (st_vae) predicted");

  const cReal = getCentroid(realPts);
  const cBase = getCentroid(baselinePts);
  const cOurs = getCentroid(oursPts);
  if (!cReal) return [];

  const annotations = [];
  if (cBase) {
    annotations.push({
      x: cReal.x,
      y: cReal.y,
      ax: cBase.x,
      ay: cBase.y,
      xref: "x",
      yref: "y",
      axref: "x",
      ayref: "y",
      showarrow: true,
      arrowhead: 3,
      arrowsize: 1,
      arrowwidth: 1.2,
      arrowcolor: "rgba(220, 38, 38, 0.65)",
      text: "",
    });
  }
  if (cOurs) {
    annotations.push({
      x: cReal.x,
      y: cReal.y,
      ax: cOurs.x,
      ay: cOurs.y,
      xref: "x",
      yref: "y",
      axref: "x",
      ayref: "y",
      showarrow: true,
      arrowhead: 3,
      arrowsize: 1,
      arrowwidth: 2,
      arrowcolor: "rgba(22, 163, 74, 0.85)",
      text: "",
    });
  }

  return annotations;
}

function render() {
  const visibleGroups = selectedGroupVisibility();
  const points = filteredPoints().filter((p) => visibleGroups[p.group]);

  const traces = [];
  ["Real", "Baseline predicted", "Ours (st_vae) predicted"].forEach((group) => {
    const trace = buildTrace(points, group);
    if (trace) traces.push(trace);
  });

  const selectedPert = ui.perturbationSelect.value;
  const focus = ui.viewModeSelect.value === "focus";
  const subtitle =
    selectedPert === "__ALL__"
      ? "all perturbations"
      : `perturbation: ${shortText(selectedPert, 44)}`;

  const layout = {
    title: {
      text: `UMAP: Real vs Predicted (${subtitle})`,
      font: { size: 18 },
    },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    legend: {
      orientation: "h",
      y: 1.05,
      x: 0,
      bgcolor: "rgba(255,255,255,0.8)",
    },
    margin: { l: 50, r: 20, t: 80, b: 50 },
    xaxis: { title: "UMAP1", zeroline: false, showgrid: true, gridcolor: "#f3f4f6" },
    yaxis: {
      title: "UMAP2",
      zeroline: false,
      showgrid: true,
      gridcolor: "#f3f4f6",
      scaleanchor: "x",
      scaleratio: 1,
    },
    hoverlabel: {
      bgcolor: "#ffffff",
      bordercolor: "#d1d5db",
      font: { color: "#111827" },
    },
    annotations: buildCentroidAnnotations(points),
  };

  const config = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
    scrollZoom: true,
  };

  Plotly.react(ui.plot, traces, layout, config);
  ui.status.textContent = `${points.length.toLocaleString()} points displayed${focus && selectedPert === "__ALL__" ? " (select a perturbation in focus mode)" : ""}.`;
}

async function init() {
  try {
    const response = await fetch(DATA_PATH);
    if (!response.ok) throw new Error(`Failed to load ${DATA_PATH}: ${response.status}`);
    const rawPoints = await response.json();

    STATE.points = rawPoints
      .map((p) => ({
        umap1: Number(p.umap1),
        umap2: Number(p.umap2),
        group: safeText(p.group),
        perturbation: safeText(p.perturbation),
        cell_id: safeText(p.cell_id),
        cell_type: safeText(p.cell_type),
        model: safeText(p.model),
        basal_reference: safeText(p.basal_reference),
        batch: safeText(p.batch),
      }))
      .filter((p) => Number.isFinite(p.umap1) && Number.isFinite(p.umap2) && GROUP_STYLE[p.group]);

    STATE.perturbations = [...new Set(STATE.points.map((p) => p.perturbation))].sort();
    STATE.cellTypes = [...new Set(STATE.points.map((p) => p.cell_type))].sort();

    populateSelect(ui.perturbationSelect, STATE.perturbations, "All perturbations");
    populateSelect(ui.cellTypeSelect, STATE.cellTypes, "All cell types");

    [
      ui.perturbationSelect,
      ui.cellTypeSelect,
      ui.searchInput,
      ui.viewModeSelect,
      ui.toggleReal,
      ui.toggleBaseline,
      ui.toggleOurs,
      ui.toggleCentroidArrows,
    ].forEach((el) => el.addEventListener("input", render));

    render();
  } catch (error) {
    ui.status.textContent = `Error: ${error.message}`;
    ui.status.style.color = "#b91c1c";
  }
}

init();
