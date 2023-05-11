import React from 'react';
import { useAddonState, useChannel } from '@storybook/manager-api';
import { AddonPanel, Form, ScrollArea, Button } from '@storybook/components';
import { ADDON_ID, EVENTS } from './constants';
import { RangeControl } from '@storybook/blocks';
import { ObjectControl } from '@storybook/blocks';
import { styled } from '@storybook/theming';
import statusTextMap from './utils/statusMap';

const statusCodes = Object.keys(statusTextMap);

const { Select } = Form;

interface PanelProps {
  active: boolean;
}

const Container = styled.div`
  box-shadow: rgb(0 0 0 / 10%) 0px 1px 3px 0px;

  & > div:not(:first-child) {
    border-block-start: 1px solid ${({ theme }) => theme.appBorderColor};
  }

  & > div:last-child {
    border-block-end: 1px solid ${({ theme }) => theme.appBorderColor};
  }

  & > div {
    padding-block: 2rem;
    padding-inline: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  h3 {
    margin-block-end: 0.5rem;
  }
`;

const ObjectControlContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.appBorderColor};
  border-radius: 5px;
  padding: 1rem;

  &:not(:first-child) {
    margin-block-start: 1rem;
  }
`;

const SBSelect = styled(Select)`
  inline-size: 100%;
`;

const Label = styled.div`
  margin-bottom: 1rem;
  flex: 1 0 50%;
`;

const ObjectsContainer = styled.div`
  flex: 1 1 50%;
`;

const SBButton = styled(Button)`
  margin-block-start: 1rem;
`;

export const Panel: React.FC<PanelProps> = (props) => {
  const [addonState, setAddonState] = useAddonState(ADDON_ID, {} as any);
  const [dataHasChanged, setDataHasChanged] = React.useState(false);

  const emit = useChannel({
    [EVENTS.SEND]: (newAddonState) => {
      setAddonState({ ...addonState, ...newAddonState });
    },
  });

  const onReset = () => {
    emit(EVENTS.RESET);
    setDataHasChanged(false);
  };

  const onChange = (key: string, value: number | string | null) => {
    emit(EVENTS.UPDATE, { key, value });
  };

  const onChangeResponse = (
    key: string,
    objectKey: string,
    objectValue: number | string
  ) => {
    setDataHasChanged(true);
    emit(EVENTS.UPDATE_RESPONSES, { key, objectKey, objectValue });
  };

  const getRender = () => {
    if (
      addonState.delay !== undefined &&
      addonState.status !== undefined &&
      addonState.responses !== undefined
    )
      return (
        <ScrollArea>
          <Container>
            <div>
              <Label>
                <h3>Response Delay : {addonState.delay} ms</h3>
                <p>Set a mock response delay</p>
              </Label>
              <RangeControl
                name="delay"
                value={addonState.delay}
                onChange={(value) => onChange('delay', value)}
                min={0}
                max={10000}
                step={500}
              />
            </div>
            <div>
              <Label>
                <h3>Response Status : {addonState.status}</h3>
                <p>Select a mock response status</p>
              </Label>
              <SBSelect
                onChange={(event) => onChange('status', event.target.value)}
                value={addonState.status}
                name="status"
              >
                {statusCodes.map((code) => (
                  <option key={code} value={code}>
                    {code} - {statusTextMap[code]}
                  </option>
                ))}
              </SBSelect>
            </div>

            <div>
              <Label>
                <h3>Response Data</h3>
                <p>Edit the mock response data</p>
              </Label>
              <ObjectsContainer>
                {addonState.responses &&
                  Object.keys(addonState.responses).length > 0 &&
                  Object.keys(addonState.responses).map((key, index) => (
                    <ObjectControlContainer key={index}>
                      <ObjectControl
                        name={key}
                        value={JSON.parse(
                          addonState.responses[key].response.body
                        )}
                        onChange={(value) =>
                          onChangeResponse('responses', key, value)
                        }
                        theme={undefined}
                      />
                    </ObjectControlContainer>
                  ))}
              </ObjectsContainer>
            </div>
            <div>
              <Label>
                <h3>Reset</h3>
                <p>Reset the original mock response data</p>
              </Label>
              <SBButton
                primary={true}
                onClick={onReset}
                disabled={!dataHasChanged}
              >
                Reset Mock Data
              </SBButton>
            </div>
          </Container>
        </ScrollArea>
      );
    return (
      <Container>
        <Label>No mock data.</Label>
      </Container>
    );
  };

  return (
    <AddonPanel {...props}>
      <div>{getRender()}</div>
    </AddonPanel>
  );
};
