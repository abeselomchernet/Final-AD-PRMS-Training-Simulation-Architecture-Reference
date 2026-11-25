import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayer } from '../../src/components/ui/VideoPlayer';

describe('VideoPlayer UI Component', () => {
  let intersectionCallback: IntersectionObserverCallback | null = null;
  const originalIntersectionObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    intersectionCallback = null;
    class MockIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = '120px';
      readonly scrollMargin = '0px';
      readonly thresholds = [0];
      constructor(cb: IntersectionObserverCallback) {
        intersectionCallback = cb;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = () => [];
    }
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver;
    vi.restoreAllMocks();
  });

  it('defers attaching video src until intersecting the viewport when lazy=true', () => {
    const { container } = render(
      <VideoPlayer
        src="https://example.local/demo.webm"
        title="Maker-Checker Demo"
        subtitle="Owner · 4 Steps"
        durationLabel="01:40"
        lazy
      />
    );

    const player = screen.getByTestId('custom-video-player');
    const videoEl = container.querySelector('video')!;
    expect(player.getAttribute('data-lazy-loaded')).toBe('false');
    expect(videoEl.getAttribute('preload')).toBe('none');
    expect(videoEl.getAttribute('src')).toBeNull();

    // Simulate scrolling into view
    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(player.getAttribute('data-lazy-loaded')).toBe('true');
    expect(videoEl.getAttribute('src')).toBe('https://example.local/demo.webm');
    expect(videoEl.getAttribute('preload')).toBe('metadata');
  });

  it('renders custom brand-aligned control overlay with speed cycling, mute toggle, seek, and error retry', () => {
    const { container } = render(
      <VideoPlayer
        src="/demo-recordings/sample.webm"
        title="Tenant Rental Collection"
        subtitle="Clerks · Finance Head"
        lazy={false}
      />
    );

    const controls = screen.getByTestId('video-player-controls');
    expect(controls).toBeInTheDocument();

    // Playback speed cycles 1x -> 1.5x -> 2x
    const speedBtn = screen.getByRole('button', { name: /Playback speed/i });
    expect(speedBtn).toHaveTextContent('1x');
    fireEvent.click(speedBtn);
    expect(speedBtn).toHaveTextContent('1.5x');
    fireEvent.click(speedBtn);
    expect(speedBtn).toHaveTextContent('2x');

    // Mute toggle updates video.muted
    const videoEl = container.querySelector('video')!;
    const muteBtn = screen.getByRole('button', { name: /Mute/i });
    fireEvent.click(muteBtn);
    expect(videoEl.muted).toBe(true);
    expect(screen.getByRole('button', { name: /Unmute/i })).toBeInTheDocument();

    // Error state shows retry affordance
    fireEvent.error(videoEl);
    expect(screen.getByText(/Unable to load video asset/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Video/i })).toBeInTheDocument();
  });

  it('renders bilingual empty state action when no video asset is selected yet', () => {
    const onEmptyAction = vi.fn();
    render(
      <VideoPlayer
        title="ERCA Verification Gate"
        emptyTitle="No Video Selected"
        emptyActionLabel="Start Recording"
        onEmptyAction={onEmptyAction}
      />
    );

    expect(screen.getByText(/No Video Selected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start Recording/i }));
    expect(onEmptyAction).toHaveBeenCalledTimes(1);
  });
});
