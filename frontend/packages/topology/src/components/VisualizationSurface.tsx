import * as React from 'react';
import * as _ from 'lodash';
import { action } from 'mobx';
import { observer } from 'mobx-react';
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore-next-line
import ReactMeasure from 'react-measure';
import ControllerContext from '../utils/ControllerContext';
import { State } from '../types';
import Visualization from '../Visualization';
import SVGDefsProvider from './defs/SVGDefsProvider';
import ElementWrapper from './ElementWrapper';

interface VisualizationSurfaceProps {
  visualization: Visualization;
  state?: State;
}

function stopEvent(e: React.MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
}

const VisualizationSurface: React.FC<VisualizationSurfaceProps> = ({ visualization, state }) => {
  React.useEffect(() => {
    state && visualization.setState(state);
  }, [visualization, state]);

  const onMeasure = React.useMemo(
    () =>
      _.debounce<any>(
        action((contentRect: { client: { width: number; height: number } }) => {
          visualization.getGraph().setBounds(
            visualization
              .getGraph()
              .getBounds()
              .clone()
              .setSize(contentRect.client.width, contentRect.client.height),
          );
        }),
        100,
        { leading: true, trailing: true },
      ),
    [visualization],
  );

  // dispose of onMeasure
  React.useEffect(() => () => onMeasure.cancel(), [onMeasure]);

  return (
    <ControllerContext.Provider value={visualization}>
      <ReactMeasure client onResize={onMeasure}>
        {({ measureRef }: { measureRef: React.LegacyRef<any> }) => (
          // render an outer div because react-measure doesn't seem to fire events properly on svg resize
          <div
            data-test-id="topology"
            style={{
              width: '100%',
              height: '100%',
              flexGrow: 1,
              flexShrink: 1,
              overflow: 'hidden',
              position: 'relative',
            }}
            ref={measureRef}
          >
            <svg
              style={{
                width: '100%',
                height: '100%',
              }}
              onContextMenu={stopEvent}
            >
              <SVGDefsProvider>
                <ElementWrapper element={visualization.getGraph()} />
              </SVGDefsProvider>
            </svg>
          </div>
        )}
      </ReactMeasure>
    </ControllerContext.Provider>
  );
};

export default observer(VisualizationSurface);
