/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    ComponentProps,
    Dispatch,
    ReactNode,
    RefCallback,
    SetStateAction,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { DragDropContext, Draggable, Droppable, DroppableProvidedProps } from "react-beautiful-dnd";
import classNames from "classnames";
import { Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { useContextMenu } from "../../structures/ContextMenu";
import TempAccountCreateMenu from "./TempAccountCreateMenu";
import { TempAccountButton, TempAccountItem } from "./TempAccountTreeLevel";
import { useEventEmitter, useEventEmitterState } from "../../../hooks/useEventEmitter";
import TempAccountStore from "../../../stores/spaces/TempAccountStore";
import {
    getMetaTempAccountName,
    MetaTempAccount,
    TempAccountKey,
    UPDATE_HOME_BEHAVIOUR,
    UPDATE_INVITED_SPACES,
    UPDATE_SELECTED_SPACE,
    UPDATE_TOP_LEVEL_SPACES,
} from "../../../stores/spaces";
import { RovingTabIndexProvider } from "../../../accessibility/RovingTabIndex";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../../../stores/notifications/RoomNotificationStateStore";
import TempAccountContextMenu from "../context_menus/TempAccountContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuCheckbox,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import UIStore from "../../../stores/UIStore";
import QuickSettingsButton from "./QuickSettingsButton";
import { useSettingValue } from "../../../hooks/useSettings";
import UserMenu from "../../structures/UserMenu";
import IndicatorScrollbar from "../../structures/IndicatorScrollbar";
import { useDispatcher } from "../../../hooks/useDispatcher";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { ActionPayload } from "../../../dispatcher/payloads";
import { Action } from "../../../dispatcher/actions";
import { NotificationState } from "../../../stores/notifications/NotificationState";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { ThreadsActivityCentre } from "./threads-activity-centre";
import AccessibleButton from "../elements/AccessibleButton";
import { Landmark, LandmarkNavigation } from "../../../accessibility/LandmarkNavigation";
import { KeyboardShortcut } from "../settings/KeyboardShortcut";

const useTempAccounts = (): [Room[], MetaTempAccount[], Room[], TempAccountKey] => {
    const invites = useEventEmitterState<Room[]>(TempAccountStore.instance, UPDATE_INVITED_SPACES, () => {
        return TempAccountStore.instance.invitedTempAccounts;
    });
    const [metaTempAccounts, actualTempAccounts] = useEventEmitterState<[MetaTempAccount[], Room[]]>(
        TempAccountStore.instance,
        UPDATE_TOP_LEVEL_SPACES,
        () => [TempAccountStore.instance.enabledMetaTempAccounts, TempAccountStore.instance.spacePanelTempAccounts],
    );
    const activeTempAccount = useEventEmitterState<TempAccountKey>(TempAccountStore.instance, UPDATE_SELECTED_SPACE, () => {
        return TempAccountStore.instance.activeTempAccount;
    });
    return [invites, metaTempAccounts, actualTempAccounts, activeTempAccount];
};

export const HomeButtonContextMenu: React.FC<ComponentProps<typeof TempAccountContextMenu>> = ({
    onFinished,
    hideHeader,
    ...props
}) => {
    const allRoomsInHome = useSettingValue("TempAccounts.allRoomsInHome");

    return (
        <IconizedContextMenu {...props} onFinished={onFinished} className="mx_TempAccountPanel_contextMenu" compact>
            {!hideHeader && <div className="mx_TempAccountPanel_contextMenu_header">{_t("common|home")}</div>}
            <IconizedContextMenuOptionList first>
                <IconizedContextMenuCheckbox
                    iconClassName="mx_TempAccountPanel_noIcon"
                    label={_t("settings|sidebar|metaspaces_home_all_rooms")}
                    active={allRoomsInHome}
                    onClick={() => {
                        onFinished();
                        SettingsStore.setValue("TempAccounts.allRoomsInHome", null, SettingLevel.ACCOUNT, !allRoomsInHome);
                    }}
                />
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>
    );
};

interface IMetaTempAccountButtonProps extends ComponentProps<typeof TempAccountButton> {
    selected: boolean;
    isPanelCollapsed: boolean;
}

type MetaTempAccountButtonProps = Pick<IMetaTempAccountButtonProps, "selected" | "isPanelCollapsed">;

const MetaTempAccountButton: React.FC<IMetaTempAccountButtonProps> = ({ selected, isPanelCollapsed, size = "32px", ...props }) => {
    return (
        <li
            className={classNames("mx_TempAccountItem", {
                collapsed: isPanelCollapsed,
            })}
            role="treeitem"
            aria-selected={selected}
        >
            <TempAccountButton {...props} selected={selected} isNarrow={isPanelCollapsed} size={size} />
        </li>
    );
};

const getHomeNotificationState = (): NotificationState => {
    return TempAccountStore.instance.allRoomsInHome
        ? RoomNotificationStateStore.instance.globalState
        : TempAccountStore.instance.getNotificationState(MetaTempAccount.Home);
};

const HomeButton: React.FC<MetaTempAccountButtonProps> = ({ selected, isPanelCollapsed }) => {
    const allRoomsInHome = useEventEmitterState(TempAccountStore.instance, UPDATE_HOME_BEHAVIOUR, () => {
        return TempAccountStore.instance.allRoomsInHome;
    });
    const [notificationState, setNotificationState] = useState(getHomeNotificationState());
    const updateNotificationState = useCallback(() => {
        setNotificationState(getHomeNotificationState());
    }, []);
    useEffect(updateNotificationState, [updateNotificationState, allRoomsInHome]);
    useEventEmitter(RoomNotificationStateStore.instance, UPDATE_STATUS_INDICATOR, updateNotificationState);

    return (
        <MetaTempAccountButton
            spaceKey={MetaTempAccount.Home}
            className="mx_TempAccountButton_home"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaTempAccountName(MetaTempAccount.Home, allRoomsInHome)}
            notificationState={notificationState}
            ContextMenuComponent={HomeButtonContextMenu}
            contextMenuTooltip={_t("common|options")}
            size="32px"
        />
    );
};

const FavouritesButton: React.FC<MetaTempAccountButtonProps> = ({ selected, isPanelCollapsed }) => {
    return (
        <MetaTempAccountButton
            spaceKey={MetaTempAccount.Favourites}
            className="mx_TempAccountButton_favourites"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaTempAccountName(MetaTempAccount.Favourites)}
            notificationState={TempAccountStore.instance.getNotificationState(MetaTempAccount.Favourites)}
            size="32px"
        />
    );
};

const PeopleButton: React.FC<MetaTempAccountButtonProps> = ({ selected, isPanelCollapsed }) => {
    return (
        <MetaTempAccountButton
            spaceKey={MetaTempAccount.People}
            className="mx_TempAccountButton_people"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaTempAccountName(MetaTempAccount.People)}
            notificationState={TempAccountStore.instance.getNotificationState(MetaTempAccount.People)}
            size="32px"
        />
    );
};

const OrphansButton: React.FC<MetaTempAccountButtonProps> = ({ selected, isPanelCollapsed }) => {
    return (
        <MetaTempAccountButton
            spaceKey={MetaTempAccount.Orphans}
            className="mx_TempAccountButton_orphans"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaTempAccountName(MetaTempAccount.Orphans)}
            notificationState={TempAccountStore.instance.getNotificationState(MetaTempAccount.Orphans)}
            size="32px"
        />
    );
};

const VideoRoomsButton: React.FC<MetaTempAccountButtonProps> = ({ selected, isPanelCollapsed }) => {
    return (
        <MetaTempAccountButton
            spaceKey={MetaTempAccount.VideoRooms}
            className="mx_TempAccountButton_videoRooms"
            selected={selected}
            isPanelCollapsed={isPanelCollapsed}
            label={getMetaTempAccountName(MetaTempAccount.VideoRooms)}
            notificationState={TempAccountStore.instance.getNotificationState(MetaTempAccount.VideoRooms)}
            size="32px"
        />
    );
};

const CreateTempAccountButton: React.FC<Pick<IInnerTempAccountPanelProps, "isPanelCollapsed" | "setPanelCollapsed">> = ({
    isPanelCollapsed,
    setPanelCollapsed,
}) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();

    useEffect(() => {
        if (!isPanelCollapsed && menuDisplayed) {
            closeMenu();
        }
    }, [isPanelCollapsed]); // eslint-disable-line react-hooks/exhaustive-deps

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed) {
        contextMenu = <TempAccountCreateMenu onFinished={closeMenu} />;
    }

    const onNewClick = menuDisplayed
        ? closeMenu
        : () => {
            if (!isPanelCollapsed) setPanelCollapsed(true);
            openMenu();
        };

    return (
        <li
            className={classNames("mx_TempAccountItem mx_TempAccountItem_new", {
                collapsed: isPanelCollapsed,
            })}
            role="treeitem"
            aria-selected={false}
        >
            <TempAccountButton
                data-testid="create-space-button"
                className={classNames("mx_TempAccountButton_new", {
                    mx_TempAccountButton_newCancel: menuDisplayed,
                })}
                label={menuDisplayed ? _t("action|cancel") : _t("create_space|label")}
                onClick={onNewClick}
                isNarrow={isPanelCollapsed}
                innerRef={handle}
                size="32px"
            />

            {contextMenu}
        </li>
    );
};

const metaTempAccountComponentMap: Record<MetaTempAccount, typeof HomeButton> = {
    [MetaTempAccount.Home]: HomeButton,
    [MetaTempAccount.Favourites]: FavouritesButton,
    [MetaTempAccount.People]: PeopleButton,
    [MetaTempAccount.Orphans]: OrphansButton,
    [MetaTempAccount.VideoRooms]: VideoRoomsButton,
};

interface IInnerTempAccountPanelProps extends DroppableProvidedProps {
    children?: ReactNode;
    isPanelCollapsed: boolean;
    setPanelCollapsed: Dispatch<SetStateAction<boolean>>;
    isDraggingOver: boolean;
    innerRef: RefCallback<HTMLElement>;
}

// Optimisation based on https://github.com/atlassian/react-beautiful-dnd/blob/master/docs/api/droppable.md#recommended-droppable--performance-optimisation
const InnerTempAccountPanel = React.memo<IInnerTempAccountPanelProps>(
    ({ children, isPanelCollapsed, setPanelCollapsed, isDraggingOver, innerRef, ...props }) => {
        return (
            <React.Fragment>
                {shouldShowComponent(UIComponent.CreateTempAccounts) && (
                    <CreateTempAccountButton isPanelCollapsed={isPanelCollapsed} setPanelCollapsed={setPanelCollapsed} />
                )}
            </React.Fragment>
        );
    },
);

const TempAccountPanel: React.FC = () => {
    // const [dragging, setDragging] = useState(false);
    // const [isPanelCollapsed, setPanelCollapsed] = useState(true);
    // const ref = useRef<HTMLDivElement>(null);
    // useLayoutEffect(() => {
    //     if (ref.current) UIStore.instance.trackElementDimensions("TempAccountPanel", ref.current);
    //     return () => UIStore.instance.stopTrackingElementDimensions("TempAccountPanel");
    // }, []);

    // useDispatcher(defaultDispatcher, (payload: ActionPayload) => {
    //     if (payload.action === Action.ToggleTempAccountPanel) {
    //         setPanelCollapsed(!isPanelCollapsed);
    //     }
    // });

    return (
        <Droppable droppableId="top-level-spaces">
            {(provided, snapshot) => (
                <InnerTempAccountPanel
                    {...provided.droppableProps}
                    isPanelCollapsed={isPanelCollapsed}
                    setPanelCollapsed={setPanelCollapsed}
                    isDraggingOver={snapshot.isDraggingOver}
                    innerRef={provided.innerRef}
                >
                    {provided.placeholder}
                </InnerTempAccountPanel>
            )}
        </Droppable>
    );
};

export default TempAccountPanel;
