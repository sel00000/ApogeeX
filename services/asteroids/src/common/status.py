"""Standard status values. A result is never invented: absent values use these markers."""

NA = "N/A"
UNKNOWN = "Unknown"
INSUFFICIENT_DATA = "Insufficient Data"
H_UNAVAILABLE = "H unavailable"
INSUFFICIENT_PHOTOMETRY = "Insufficient optical photometry"
ALBEDO_NOT_ESTIMABLE = "Not estimable from available data"
UNMATCHED_CANDIDATE = "Unmatched Candidate"
UNCATALOGUED_CANDIDATE = "Uncatalogued Candidate"
SPHERICAL_ASSUMPTION = "spherical_assumption"

# Data origin labels. Observed and simulated data must never be mixed.
ORIGIN_OBSERVED = "OBSERVED"
ORIGIN_SIMULATED = "SIMULATED"

# Quality flags for spectral points
Q_GOOD = "GOOD"
Q_WARN = "WARN"
Q_BAD = "BAD"

# Confidence levels
CONF_HIGH = "High"
CONF_MEDIUM = "Medium"
CONF_LOW = "Low"
CONF_NONE = "None"
