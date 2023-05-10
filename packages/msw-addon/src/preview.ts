import type { Renderer, ProjectAnnotations } from '@storybook/types';
import { withRoundTrip } from './withRoundTrip';

const preview: ProjectAnnotations<Renderer> = {
  decorators: [withRoundTrip],
};

export default preview;
