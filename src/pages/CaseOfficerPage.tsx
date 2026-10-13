import React from 'react';
import { ForensicEngine } from '../engine/engine';
import { TraceResult } from '../types/dataset';
import { CaseOfficerComponent } from '../parts/CaseOfficer/CaseOfficerComponent';

interface CaseOfficerPageProps {
  engine: ForensicEngine;
  activeTrace: TraceResult | null;
  onNavigateTrace: () => void;
  localLlmEndpoint?: string;
}

export const CaseOfficerPage: React.FC<CaseOfficerPageProps> = ({
  engine,
  activeTrace,
  onNavigateTrace,
}) => {
  return (
    <CaseOfficerComponent
      engine={engine}
      activeTrace={activeTrace}
      onNavigateTrace={onNavigateTrace}
    />
  );
};
