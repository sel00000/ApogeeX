"""Prior information about one target for the classifier and the statistical diameter.

A TargetPrior is built outside the analysis code (src/integration/population_context.py) from the
object's orbit, its H and, if available, a measured albedo, using the population model of
src/physical/population_priors.py. It carries no class label of the object: the population model is
trained without the object's own catalogue rows.

In classify() the class score becomes
    w_k = deviance_k / s + 2 ln n_c(k) - 2 ln P(c(k)) - 2 ln p(pV | c(k))
  * deviance_k / s     - the spectral term (scaled deviance, as before);
  * 2 ln n_c           - spreads the prior of a complex over its n_c classes (C-complex has six classes,
                         K one; without this term a complex with more classes gets more prior mass);
  * ln P(c)            - tempered population frequency and orbit information (complex_log_prior);
  * ln p(pV | c)       - albedo likelihood (albedo_loglike), when an albedo is measured.
Complex scores are -2 ln sum_k exp(-w_k / 2) over the classes of the complex, so the complex order and the
complex probabilities agree. The exponents and the albedo term were chosen by injection-recovery of 190
real spectra (docs/METHODS.md section 4c).
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TargetPrior:
    complex_log_prior: dict | None = None      # ln P(complex), normalised
    albedo_loglike: dict | None = None         # ln p(measured pV | complex)
    albedo: dict | None = None                 # {"pV", "log10_pv", "sigma_log10", "source"}
    orbit: dict | None = None                  # {"a_au", "e", "i_deg"}
    H: float | None = None
    model: object | None = None                # PopulationPriorModel (statistical diameter, thermal albedo)
    info: dict = field(default_factory=dict)   # provenance: exponents, training sizes, exclusions

    def without_albedo(self) -> "TargetPrior":
        return TargetPrior(complex_log_prior=self.complex_log_prior, albedo_loglike=None, albedo=None,
                           orbit=self.orbit, H=self.H, model=self.model, info=dict(self.info))

    def with_albedo(self, log10_pv: float, sigma_log10: float, source: str) -> "TargetPrior":
        if self.model is None:
            return self
        return TargetPrior(complex_log_prior=self.complex_log_prior,
                           albedo_loglike=self.model.albedo_loglike(log10_pv, sigma_log10),
                           albedo={"pV": 10 ** log10_pv, "log10_pv": log10_pv, "sigma_log10": sigma_log10,
                                   "source": source},
                           orbit=self.orbit, H=self.H, model=self.model, info=dict(self.info))

    def summary(self) -> dict:
        return {"complex_log_prior": self.complex_log_prior, "albedo": self.albedo,
                "albedo_loglike": self.albedo_loglike, "orbit": self.orbit, "H": self.H, "info": self.info}
