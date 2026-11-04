# Cut-over runbook

Moves <https://www.ahmadnaeem.dev> from the old site on the `gh-pages` branch to the Astro site, published by the `Deployment` workflow. Done once.

**Ahmad approves and runs every step that changes something:** the settings changes, the merge, any rollback, and deleting branches. Nobody does these on his behalf without asking him first. The commands marked read-only change nothing.

Run the `gh` commands signed in with admin rights on the repository.

## Before

Do not start until all of these hold. Check them just before step 1 of the order: a merge refused after the source has been switched leaves the site in the gap described under [What is and isn't known](#what-is-and-isnt-known).

1. The merge rule Ahmad chose for `main` is applied. Read-only:

   ```sh
   gh api repos/AhmadNaeemK/ahmadnaeemk.github.io/branches/main/protection \
     --jq '{checks: .required_status_checks.contexts, reviews: .required_pull_request_reviews.required_approving_review_count, admins: .enforce_admins.enabled}'
   ```

   Expected: the values of the rule he chose, which is his decision. For the rule recommended for a solo repository, that is `checks` of `["checks"]`, `reviews` of `0` or `null`, and `admins` of `true`.

2. The new workflow has reached `redesign/astro`. Read-only, expected to print `1`:

   ```sh
   git fetch origin redesign/astro && git show origin/redesign/astro:.github/workflows/deploy.yml | grep -c withastro/action
   ```

3. #28 is out of draft, green and able to merge. The first command changes the PR, and the other two are read-only:

   ```sh
   gh pr ready 28
   gh pr checks 28
   gh pr view 28 --json isDraft,mergeable,mergeStateStatus
   ```

   Expected: every check passes, `isDraft` is `false`, `mergeable` is `MERGEABLE`, and `mergeStateStatus` is `CLEAN`. A rule that requires a review shows `BLOCKED` until someone else approves, so settle the rule first. If this isn't `CLEAN`, don't switch the source.

4. The real-device sign-off is done.
5. The current Pages settings are noted, to compare with later. Read-only:

   ```sh
   gh api repos/AhmadNaeemK/ahmadnaeemk.github.io/pages \
     --jq '{status, build_type, source, cname, https_enforced, certificate: .https_certificate.state}'
   ```

   Expected: `legacy`, branch `gh-pages`, `www.ahmadnaeem.dev`, HTTPS enforced, certificate `approved`.

## Order

Do steps 1 and 2 close together, in one sitting. See [What is and isn't known](#what-is-and-isnt-known).

1. **Switch the Pages source.** Under **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**. Skip the suggested workflow templates. The API equivalent is below, but it hasn't been run on this repository:

   ```sh
   gh api -X PUT repos/AhmadNaeemK/ahmadnaeemk.github.io/pages -f build_type=workflow
   ```

   Then rerun the read-only settings command from step 5 of **Before**. `build_type` should be `workflow` and `cname` should still be `www.ahmadnaeem.dev`. If the domain is gone, set it again under **Settings → Pages → Custom domain**.

   Next, check the branch rule on the `github-pages` environment. Read-only:

   ```sh
   gh api repos/AhmadNaeemK/ahmadnaeemk.github.io/environments/github-pages \
     --jq '.deployment_branch_policy'
   gh api repos/AhmadNaeemK/ahmadnaeemk.github.io/environments/github-pages/deployment-branch-policies \
     --jq '.branch_policies[].name'
   ```

   Expected: the policy isn't `null`, and `main` can deploy. That means either `protected_branches` is `true`, or `custom_branch_policies` is `true` and the second command lists `main`. The second command returns a 404 when there are no custom policies. If the policy is `null`, restrict it to `main` under **Settings → Environments → github-pages → Deployment branches and tags**. It was `null` before the switch. The `deploy-pages` README says GitHub configures protection by default for an Actions source, but it may not do so for an environment that already exists.

   This rule is a second layer, because the workflow already skips both jobs on any branch but `main`.

2. **Merge #28**, `redesign/astro` into `main`. The push starts `Deployment`. The old workflow is replaced in the same merge, so it can't overwrite `gh-pages`.

   ```sh
   gh pr merge 28 --merge
   ```

3. **Watch the deploy.**

   ```sh
   gh run list --workflow deploy.yml --limit 3
   gh run watch <run id> --exit-status
   ```

   If it fails, read the log with `gh run view <run id> --log-failed`. To try again, run `gh run rerun <run id>`, or start a new run with `gh workflow run deploy.yml --ref main`.

4. **Confirm the domain and HTTPS** under **Settings → Pages**, or with the read-only settings command. Expected: `status` is `built`, `build_type` is `workflow`, `cname` is `www.ahmadnaeem.dev`, `https_enforced` is `true`, certificate `approved`. A certificate can take up to an hour after a domain is configured. If the domain had to be set again in step 1, allow for that.

5. **Run the smoke check**, straight away and again once the certificate has settled.

## Smoke check

Run against the live URL.

Each of these prints `200`:

```sh
BASE=https://www.ahmadnaeem.dev
for path in / /404.html /Ahmad_Naeem_CV.pdf /sitemap-index.xml /robots.txt \
  /favicon.ico /favicon.svg /apple-touch-icon.png /og-image.png; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")" "$path"
done
```

An unknown path and the old blog paths print `404`, and show the custom 404 page in a browser:

```sh
for path in /no-such-page /blog /blog/; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")" "$path"
done
```

Apex and `www`, over HTTP and HTTPS, all end at `200 https://www.ahmadnaeem.dev/`:

```sh
for start in http://ahmadnaeem.dev https://ahmadnaeem.dev \
  http://www.ahmadnaeem.dev https://www.ahmadnaeem.dev; do
  curl -sL -o /dev/null -w "%{http_code} %{url_effective} (from $start)\n" "$start/"
done
```

The canonical tag prints `<link rel="canonical" href="https://www.ahmadnaeem.dev/">`:

```sh
curl -s "$BASE/" | grep -o '<link rel="canonical"[^>]*>'
```

In a browser, because the hash never reaches the server:

- `/` shows the real site, not the old one and not an empty page. Reload with the cache bypassed.
- `/#interchange`, `/#diorama` and `/#pixel-depot` each show that theme.

## Rollback

Use this if the deploy can't be made to work or the live site is wrong.

1. **Stop new deploys**, so a push to `main` can't publish the Astro site over the rollback. Disabling doesn't stop a run already going, so cancel any with `gh run cancel <run id>`.

   ```sh
   gh workflow disable deploy.yml
   gh run list --workflow deploy.yml --limit 3
   ```

2. **Let `gh-pages` deploy.** A branch rule that only allows `main` could reject the old site's build. Under **Settings → Environments → github-pages → Deployment branches and tags**, choose **No restriction**, or add `gh-pages`. Then recheck, read-only:

   ```sh
   gh api repos/AhmadNaeemK/ahmadnaeemk.github.io/environments/github-pages \
     --jq '.deployment_branch_policy'
   gh api repos/AhmadNaeemK/ahmadnaeemk.github.io/environments/github-pages/deployment-branch-policies \
     --jq '.branch_policies[].name'
   ```

   Expected: the policy is `null` for no restriction, and the second command then returns a 404. Otherwise, the second command lists `gh-pages`.

3. **Switch the source back.** Under **Settings → Pages → Build and deployment → Source**, choose **Deploy from a branch**, then `gh-pages` and `/ (root)`. The branch still holds the old site and a `CNAME` for `www.ahmadnaeem.dev`. The API equivalent, also not yet run on this repository:

   ```sh
   gh api -X PUT repos/AhmadNaeemK/ahmadnaeemk.github.io/pages \
     -f build_type=legacy -f 'source[branch]=gh-pages' -f 'source[path]=/'
   ```

4. **Confirm the domain** with the read-only settings command, which should match the values noted in step 5 of **Before**. If the old site doesn't come back, request a build:

   ```sh
   gh api -X POST repos/AhmadNaeemK/ahmadnaeemk.github.io/pages/builds
   ```

   That may not rebuild a `gh-pages` source. If it doesn't, push an empty commit to the branch, without touching your checkout:

   ```sh
   git fetch origin gh-pages
   git push origin "$(git commit-tree 'origin/gh-pages^{tree}' -p origin/gh-pages -m 'chore: rebuild old site'):refs/heads/gh-pages"
   ```

5. **Check** `https://www.ahmadnaeem.dev/` in a browser.
6. **When the rollback is over**, and only once the source is back on **GitHub Actions** and the branch rule allows `main` again, turn deploys back on:

   ```sh
   gh workflow enable deploy.yml
   ```

This doesn't undo the merge. `main` keeps the new workflow, which no longer writes to `gh-pages`, so that workflow can't change the branch itself. A run from `main` could still publish over the rollback. The `deploy-pages` README says a deployment must come from the source branch unless the environment is protected, and that a protected environment's rules then take precedence. So a branch rule that allows `main` may let the run through, which is why step 1 disables the workflow.

Steps 1 and 2 and the empty commit are inferred from that README and from the repository's `pages-build-deployment` workflow, which publishes a branch source. None of this has been tested.

## What is and isn't known

**Documented:**

- A custom workflow ignores any `CNAME` file and doesn't need one, and a `CNAME` file doesn't add or remove a custom domain ([custom domain troubleshooting](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages), [publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)).
- HTTPS can take up to an hour after a custom domain is configured.
- With a branch source, a deployment must come from that branch unless the environment is protected ([`deploy-pages` README](https://github.com/actions/deploy-pages/blob/v5.0.1/README.md)). That is why the source is switched first: while the environment has no protection, merging first would run a deploy from `main` that should be rejected.

**Not documented, as far as the pages above go, and not tested here:**

- What the site serves between the switch and the first Actions deploy. It may keep serving the last published site, or nothing. Treat it as a possible outage, which is why steps 1 and 2 go together.
- Whether switching the source keeps the custom domain and certificate. The domain is a separate setting, so it is expected to stay, but that is why step 1 checks it.
- How quickly switching back to a branch source publishes again, and whether it needs the build request or the empty commit in step 4 of the rollback.
- Whether an environment branch rule can reject the old site's `gh-pages` build, and whether a run from `main` can publish over a branch source. Steps 1 and 2 of the rollback guard against both.

The workflow itself has never run. It can't publish until the source is switched, so the first real deploy is the launch.

## After

`gh-pages` and `master` stay for a week after launch, since `gh-pages` is the rollback. After that, delete them only with Ahmad's approval:

```sh
git push origin --delete gh-pages master
```
