# Authentication and application access

Daily Hero Association uses the shared `lab` realm at https://auth.lab.test. Account management belongs to [Lab Identity](../lab-identity/README.md). New users receive only Lab Identity self-service access; a lab administrator must explicitly grant `hero-association:app-user` before game onboarding.

The BFF remains a confidential PKCE authorization-code client (`hero-association-bff`). Tokens and refresh state stay in its Redis instance; the browser receives secure HttpOnly session cookies. All mutations require the signed CSRF cookie and header. `/api/v1/session` remains public so signed-out and denied users can see their login state.

Every game API validates the shared issuer and its own resource audience, and requires the canonical Hero client `app-user` role. BFF scopes include only Hero access; a Lab Identity token cannot be used at a Hero API. Functional game authorization still uses Manager ownership and agency membership, independently of the base application grant.

A shared Keycloak `sub` links to the immutable `account.keycloak_subject`. On the first authorized account request, Core provisions its local Account; the player chooses a Manager name and creates or joins an agency. Lab Identity never creates Manager or agency data.

Revoking Hero access ends Keycloak sessions and requires a fresh login. Existing JWTs expire within 60 seconds. Other application grants remain unchanged. The frontend shows **Hero Association access required** when the game grant is missing. Public registration is disabled in the daily lab; administrators create accounts and send Keycloak-managed password reset emails.

The disposable E2E and standalone Compose stacks retain their private `hero-association` fixture realm and test registration, with seeded Hero grants. They do not manage shared daily accounts.
