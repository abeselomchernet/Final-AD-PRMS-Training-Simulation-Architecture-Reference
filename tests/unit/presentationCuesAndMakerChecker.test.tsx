import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEMO_SCENARIOS } from '../../src/data/demoWalkthroughs';
import { PresentationCues } from '../../src/components/demo/PresentationCues';
import { MakerCheckerSimulation } from '../../src/components/demo/MakerCheckerSimulation';

describe('PresentationCues & Interactive MakerCheckerSimulation', () => {
  it('renders bilingual Amharic-English talking points per stakeholder chapter and opens floating teleprompter overlay', () => {
    const onJumpToModule = vi.fn();
    const onStepChange = vi.fn();
    const scenario = DEMO_SCENARIOS[0];

    render(
      <PresentationCues
        activeChapterId="owner"
        scenario={scenario}
        activeKeyframe={scenario.keyframes[0]}
        activeStepIndex={0}
        locale="en"
        targetAccessEnabled
        currentRole="Owner / Director"
        onJumpToModule={onJumpToModule}
        onStepChange={onStepChange}
      />
    );

    expect(screen.getByTestId('presentation-cues-panel')).toBeInTheDocument();
    expect(screen.getByText(/Owner Chapter Talking Points/i)).toBeInTheDocument();
    expect(screen.getByText(/Rental title-holder ledger is strictly isolated/i)).toBeInTheDocument();

    // Open floating bilingual teleprompter overlay
    fireEvent.click(screen.getByRole('button', { name: /Open Overlay View/i }));
    const overlay = screen.getByTestId('presentation-cues-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.textContent).toContain(scenario.keyframes[0].amharicScript);

    // Advance next step from overlay controls
    fireEvent.click(screen.getByRole('button', { name: /Overlay next step/i }));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it('guides user step-by-step from Clerk creation through 403 Self-Approval block to Owner/Finance approval', () => {
    const StepWrapper: React.FC = () => {
      const [step, setStep] = React.useState(0);
      return (
        <MakerCheckerSimulation
          activeStepIndex={step}
          onStepChange={setStep}
          locale="en"
        />
      );
    };

    render(<StepWrapper />);
    expect(screen.getByTestId('maker-checker-interactive-sim')).toBeInTheDocument();

    // Step 1: Clerk submits transaction
    fireEvent.click(screen.getByRole('button', { name: /Submit as Clerk \(Maker\)/i }));
    expect(screen.getByText(/2\. SoD Self-Approval Guard/i)).toBeInTheDocument();

    // Step 2: Test Self-Approve HTTP 403 block, then hand off to Owner/Finance checker
    fireEvent.click(screen.getByRole('button', { name: /Test Self-Approve \(Blocked 403\)/i }));
    expect(screen.getByText(/BLOCKED \(HTTP 403\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Switch to Owner \/ Finance Checker/i }));
    expect(screen.getByText(/2\. Owner \/ Finance Checker/i)).toBeInTheDocument();

    // Step 3: Select Finance Head and Approve
    fireEvent.change(screen.getByLabelText(/Approving Authority/i), {
      target: { value: 'Finance Head' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Approve & Sign as Finance Head/i }));

    // Step 4: Locked PR-25 & SHA-256 hash proof
    expect(screen.getByText(/SHA-256: e81b20\.\.\.c49f \(LOCKED\)/i)).toBeInTheDocument();
  });
});
