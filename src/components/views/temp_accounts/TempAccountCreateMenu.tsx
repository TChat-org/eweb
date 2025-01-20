/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    ComponentProps,
    RefObject,
    SyntheticEvent,
    KeyboardEvent,
    useContext,
    useRef,
    useState,
    ChangeEvent,
    ReactNode,
    useEffect,
} from "react";
import classNames from "classnames";
import {
    RoomType,
    HistoryVisibility,
    Preset,
    Visibility,
    MatrixClient,
    ICreateRoomOpts,
    createClient,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler.tsx";
import ContextMenu, { ChevronFace } from "../../structures/ContextMenu.tsx";
import createRoom, { IOpts as ICreateOpts } from "../../../createRoom.ts";
import MatrixClientContext, { useMatrixClientContext } from "../../../contexts/MatrixClientContext.tsx";
import TempAccountBasicSettings, { TempAccountAvatar } from "./TempAccountBasicSettings.tsx";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton.tsx";
import Field from "../elements/Field.tsx";
import withValidation from "../elements/Validation.tsx";
import RoomAliasField from "../elements/RoomAliasField.tsx";
import { getKeyBindingsManager } from "../../../KeyBindingsManager.ts";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts.ts";
import defaultDispatcher from "../../../dispatcher/dispatcher.ts";
import { Action } from "../../../dispatcher/actions.ts";
import { Filter } from "../dialogs/spotlight/Filter.ts";
import { OpenSpotlightPayload } from "../../../dispatcher/payloads/OpenSpotlightPayload.ts";
import PassphraseField from "../auth/PassphraseField.tsx";
import PassphraseConfirmField from "../auth/PassphraseConfirmField.tsx";
import RegistrationForm from "../auth/RegistrationForm.tsx";
import { ValidatedServerConfig } from "../../../utils/ValidatedServerConfig.ts";
import SdkConfig from "../../../SdkConfig.ts";
import { IMatrixClientCreds, MatrixClientPeg } from "../../../MatrixClientPeg.ts";
import Registration from "../../structures/auth/Registration.tsx";

// enum RegistrationField {
//     Email = "field_email",
//     PhoneNumber = "field_phone_number",
//     Username = "field_username",
//     Password = "field_password",
//     PasswordConfirm = "field_password_confirm",
// }

// enum UsernameAvailableStatus {
//     Unknown,
//     Available,
//     Unavailable,
//     Error,
//     Invalid,
// }

// type BProps = Omit<ComponentProps<typeof TempAccountBasicSettings>, "nameDisabled" | "topicDisabled" | "avatarDisabled">;
// interface ITempAccountCreateFormProps extends BProps {
//     busy: boolean;
//     alias: string;
//     nameFieldRef: RefObject<Field>;
//     aliasFieldRef: RefObject<RoomAliasField>;
//     showAliasField?: boolean;
//     children?: ReactNode;
//     onSubmit(e: SyntheticEvent): void;
//     setAlias(alias: string): void;
// }

// export const TempAccountCreateForm: React.FC<ITempAccountCreateFormProps> = ({
//     busy,
//     onSubmit,
//     avatarUrl,
//     setAvatar,
//     name,
//     setName,
//     nameFieldRef,
//     alias,
//     aliasFieldRef,
//     setAlias,
//     showAliasField,
//     topic,
//     setTopic,
//     children,
// }) => {
//     const cli = useContext(MatrixClientContext);
//     const domain = cli.getDomain() ?? undefined;

//     const onKeyDown = (ev: KeyboardEvent): void => {
//         const action = getKeyBindingsManager().getAccessibilityAction(ev);
//         switch (action) {
//             case KeyBindingAction.Enter:
//                 onSubmit(ev);
//                 break;
//         }
//     };



//     const [username, setUsername] = useState<string>("")

//     const onUsernameChange = () => {

//     }

//     const onUsernameValidate = () => {

//     }


//     return (
//         <form className="mx_TempAccountBasicSettings" onSubmit={onSubmit}>
//             <TempAccountAvatar avatarUrl={avatarUrl} setAvatar={setAvatar} avatarDisabled={busy} />

//             <Field
//                 id="mx_RegistrationForm_username"
//                 ref={(field) => (this[RegistrationField.Username] = field)}
//                 type="text"
//                 autoFocus={true}
//                 label={_t("common|username")}
//                 placeholder={_t("common|username")}
//                 value={username}
//                 onChange={onUsernameChange}
//                 onValidate={onUsernameValidate}
//                 tooltipAlignment={tooltipAlignment()}
//                 autoCorrect="off"
//                 autoCapitalize="none"
//             />

//             <div className="mx_AuthBody_fieldRow">
//                 <PassphraseField
//                     id="mx_RegistrationForm_password"
//                     fieldRef={(field) => (this[RegistrationField.Password] = field)}
//                     minScore={PASSWORD_MIN_SCORE}
//                     value={this.state.password}
//                     onChange={this.onPasswordChange}
//                     onValidate={this.onPasswordValidate}
//                     userInputs={[this.state.username]}
//                     tooltipAlignment={this.tooltipAlignment()}
//                 />

//                 <PassphraseConfirmField
//                     id="mx_RegistrationForm_passwordConfirm"
//                     fieldRef={(field) => (this[RegistrationField.PasswordConfirm] = field)}
//                     autoComplete="new-password"
//                     value={this.state.passwordConfirm}
//                     password={this.state.password}
//                     onChange={this.onPasswordConfirmChange}
//                     onValidate={this.onPasswordConfirmValidate}
//                     tooltipAlignment={this.tooltipAlignment()}
//                 />
//             </div>

//             {children}
//         </form>
//     );
// };

const TempAccountCreateMenu: React.FC<{
    onFinished(): void;
}> = ({ onFinished }) => {
    const cli = useMatrixClientContext();
    const [visibility, setVisibility] = useState<string | null>(null);
    const [busy, setBusy] = useState<boolean>(false);

    // const tempAccountNameField = useRef<Field>(null);
    // const tempAccountAliasField = useRef<RoomAliasField>(null);

    // const [formVals, setFormVals] = useState<Record<string, string | undefined>>();
    // const [flows, setFlows] = useState<any>(null);
    // const [serverErrorIsFatal, setServerErrorIsFatal] = useState<boolean>(false);
    const [serverConfig, setServerConfig] = useState<ValidatedServerConfig>();
    const [isMobileRegistration, setIsMobileRegistration] = useState<boolean>(false);

    const getServerProperties = (): { serverConfig: ValidatedServerConfig } => {
        const props = serverConfig || SdkConfig.get("validated_server_config")!;
        return { serverConfig: props };
    }

    // const onTempAccountCreateClick = async (e: ButtonEvent): Promise<void> => {
    //     e.preventDefault();
    //     if (busy) return;

    //     setBusy(true);
    //     // require & validate the tempAccount name field
    //     if (tempAccountNameField.current && !(await tempAccountNameField.current.validate({ allowEmpty: false }))) {
    //         tempAccountNameField.current.focus();
    //         tempAccountNameField.current.validate({ allowEmpty: false, focused: true });
    //         setBusy(false);
    //         return;
    //     }
    // };

    const onUserCompletedLoginFlow = async (credentials: IMatrixClientCreds): Promise<void> => {
        // // Create and start the client
        // await Lifecycle.setLoggedIn(credentials);
        // await this.postLoginSetup();

        // PerformanceMonitor.instance.stop(PerformanceEntryNames.LOGIN);
        // PerformanceMonitor.instance.stop(PerformanceEntryNames.REGISTER);
    };

    const onRegisterFlowComplete = (credentials: IMatrixClientCreds): Promise<void> => {
        return onUserCompletedLoginFlow(credentials);
    }

    const onLoginClick = (): void => {
    }

    const onServerConfigChange = (serverConfig: ValidatedServerConfig): void => {
    }


    let body;
    if (true) {
        body = (
            <React.Fragment>
                <AccessibleButton
                    className="mx_TempAccountCreateMenu_back"
                    onClick={() => setVisibility(null)}
                    title={_t("action|go_back")}
                />

                <h2>
                    Tạo tài khoản tạm thời
                </h2>
                <p>
                    _t("create_temp_user|add_details_prompt") _t("create_temp_user|add_details_prompt_2")
                </p>

                <Registration
                    // clientSecret={this.state.register_client_secret}
                    // sessionId={this.state.register_session_id}
                    // idSid={this.state.register_id_sid}
                    // email={email}
                    // brand={this.props.config.brand}
                    onLoggedIn={onRegisterFlowComplete}
                    onLoginClick={onLoginClick}
                    onServerConfigChange={onServerConfigChange}
                    // defaultDeviceDisplayName={this.props.defaultDeviceDisplayName}
                    // fragmentAfterLogin={fragmentAfterLogin}
                    mobileRegister={isMobileRegistration}
                    showFormOnly={true}
                    {...getServerProperties()}
                />

                {/* <AccessibleButton kind="primary" onClick={onTempAccountCreateClick} disabled={busy}>
                    {busy ? _t("create_space|creating") : _t("action|create")}
                </AccessibleButton> */}
            </React.Fragment>
        );
    }

    return (
        <ContextMenu
            left={72}
            top={62}
            chevronOffset={0}
            chevronFace={ChevronFace.None}
            onFinished={onFinished}
            wrapperClassName="mx_SpaceCreateMenu_wrapper"
            managed={false}
            focusLock={true}
        >
            {body}
        </ContextMenu>
    );
};

export default TempAccountCreateMenu;
