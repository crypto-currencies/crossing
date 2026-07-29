"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Search } from "lucide-react";
import { SEARCH_LANGUAGE } from "./search-language";
import styles from "./search-results.module.css";

const STEPS = SEARCH_LANGUAGE.loading.steps;

export function SearchProgress() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, 900);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className={styles.progressCard} aria-label="Search in progress">
      <div className={styles.progressIntro}>
        <span className={styles.progressIcon}>
          <Search size={20} aria-hidden />
        </span>
        <div>
          <h2>{SEARCH_LANGUAGE.loading.heading}</h2>
          <p>{SEARCH_LANGUAGE.loading.introduction}</p>
        </div>
      </div>
      <ol className={styles.progressSteps}>
        {STEPS.map((step, index) => (
          <li className={index === activeStep ? styles.activeProgressStep : ""} key={step}>
            <span aria-hidden>
              {index < activeStep ? (
                <Check size={14} />
              ) : index === activeStep ? (
                <LoaderCircle className={styles.spinner} size={14} />
              ) : (
                index + 1
              )}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className={styles.progressSkeleton} aria-hidden>
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </section>
  );
}
