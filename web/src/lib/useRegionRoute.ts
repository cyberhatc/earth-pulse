"use client";

import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInvestigation } from "./context";
import { getRegion } from "./data";
import type { Region } from "./types";

export function useRegionRoute(): {
  slug: string;
  region: Region | null;
  hydrated: boolean;
} {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { hydrated, region, setRegion } = useInvestigation();

  useEffect(() => {
    if (!hydrated) return;
    const found = getRegion(slug);
    if (!found) {
      navigate("/regions", { replace: true });
      return;
    }
    if (region?.slug !== slug) {
      setRegion(found);
    }
  }, [hydrated, slug, region?.slug, setRegion, navigate]);

  const activeRegion = region?.slug === slug ? region : getRegion(slug) ?? null;

  return {
    slug,
    region: activeRegion,
    hydrated,
  };
}
