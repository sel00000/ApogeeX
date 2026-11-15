"""One colour scheme for every figure (dashboard, report PNGs, ad-hoc plots).

The figures are drawn on the dashboard's own background (Streamlit dark theme, pinned in
.streamlit/config.toml), so a plot sits in the page without a visible white box: figure and axes
share the page colour; text, axes and grid use the theme's ink. Change colours here only.

Series colours: the dataviz reference palette, dark steps, in its fixed order (never cycled).
Validated on this surface with the dataviz validator (2026-11-14, --mode dark --surface #0E1117):
lightness band, chroma, adjacent CVD separation (worst dE 8.4), normal-vision floor (19.3) and >= 3:1
contrast all pass; the first three slots also pass all-pairs (lines that cross).
Quality flags use the status colours (good / warning) and a muted grey for points not used, and they
also differ by marker, so identity never rests on colour alone.
"""
from __future__ import annotations

SURFACE = "#0E1117"      # page = figure = axes background (Streamlit dark backgroundColor)
PANEL = "#262730"        # secondary background (Streamlit secondaryBackgroundColor): legend frame, boxes
TEXT = "#FAFAFA"         # primary ink: titles, data points of the observation
TEXT_2 = "#C3C2B7"       # secondary ink: axis labels, tick labels, legend text
MUTED = "#898781"        # muted ink: ticks, reference tracks, points not used
GRID = "#262730"         # hairline grid
AXIS = "#3D4050"         # spines and zero lines

SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"]
BLUE, ORANGE, AQUA, YELLOW, MAGENTA, GREEN, VIOLET, RED = SERIES

STATUS_GOOD, STATUS_WARNING = "#0ca30c", "#fab219"
QUALITY = {"GOOD": (STATUS_GOOD, "o"), "WARN": (STATUS_WARNING, "s"), "BAD": (MUTED, "x")}


def rc() -> dict:
    from cycler import cycler
    return {
        "figure.facecolor": SURFACE, "figure.edgecolor": SURFACE,
        "savefig.facecolor": SURFACE, "savefig.edgecolor": SURFACE, "savefig.transparent": False,
        "axes.facecolor": SURFACE, "axes.edgecolor": AXIS, "axes.linewidth": 0.8,
        "axes.labelcolor": TEXT_2, "axes.titlecolor": TEXT, "axes.titleweight": "normal",
        "axes.grid": True, "axes.axisbelow": True, "axes.spines.top": False, "axes.spines.right": False,
        "axes.prop_cycle": cycler(color=SERIES),
        "grid.color": GRID, "grid.linewidth": 0.6, "grid.alpha": 1.0,
        "text.color": TEXT,
        "xtick.color": MUTED, "ytick.color": MUTED, "xtick.labelcolor": TEXT_2, "ytick.labelcolor": TEXT_2,
        "legend.facecolor": SURFACE, "legend.edgecolor": PANEL, "legend.labelcolor": TEXT_2,
        "legend.framealpha": 1.0,
        "lines.linewidth": 2.0, "lines.markersize": 4, "errorbar.capsize": 0,
        "patch.edgecolor": SURFACE,
        "boxplot.boxprops.color": TEXT_2, "boxplot.whiskerprops.color": TEXT_2, "boxplot.capprops.color": TEXT_2,
        "boxplot.medianprops.color": ORANGE, "boxplot.flierprops.markeredgecolor": MUTED,
        "font.family": "sans-serif",
    }


def apply() -> None:
    """Set the scheme for every matplotlib figure created afterwards in this process."""
    import matplotlib as mpl
    mpl.rcParams.update(rc())
