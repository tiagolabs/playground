# Manual identity and application-access test

1. Open https://identity.lab.test and sign in with `lab-admin` / `lab-admin`.
2. Open **Users & access**, create a user with username, email, first name, and last name. Confirm only Lab Identity access is selected.
3. Send its password reset email. Port-forward Mailpit with `kubectl --kubeconfig infra/.local/kubeconfig -n identity port-forward service/mailpit 18025:8025`, open http://localhost:18025, and follow the action link in a private browser. Set a password in Keycloak.
4. Sign in as the new user. Confirm the Applications page shows Lab Identity access and Hero access required. User administration must be absent, and its API must return 403. Open **My profile**, then **Manage password and account security**; Keycloak's account console should reuse SSO.
5. Visit https://heroassociation.test and sign in with the same account. Confirm **Hero Association access required**; a game account must not be provisioned.
6. As the administrator, grant Hero Association. Sign the member in again, open Hero, and complete Manager and agency onboarding. The shared Keycloak subject now links to a project-owned game account.
7. Open Lab Identity in the same browser. Its login should reuse SSO without asking for the password again. Hero and Lab Identity still have separate app sessions.
8. Grant Pix, revoke Hero, and sign the member in again. Confirm Pix's grant remains independent, its launch stays planned, and Hero is denied. Previously issued tokens expire within 60 seconds.
9. Disable the member; new login must fail. Re-enable it and request a new reset email if needed. Try disabling the current administrator: the API must reject it.
10. Verify Raydow still opens on its existing HTTPS host, while lab URLs use 127.0.0.2:443 in both WSL and Windows.

The public seed users `user1@mail.com` / `user1` and `user2@mail.com` / `user2` have existing game fixtures. `user3@mail.com` / `user3` has Hero access but no game account/Manager until first use.
