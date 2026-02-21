/*
 * Copyright 2018 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

@file:Suppress(
    "unused",
    "nothing_to_inline",
    "useless_cast",
    "unchecked_cast",
    "extension_shadowed_by_member",
    "redundant_projection",
    "RemoveRedundantBackticks",
    "ObjectPropertyName",
    "deprecation",
    "detekt:all"
)
@file:org.gradle.api.Generated

package org.gradle.kotlin.dsl

import org.gradle.plugin.use.PluginDependenciesSpec
import org.gradle.plugin.use.PluginDependencySpec


/**
 * The `org` plugin group.
 */
@org.gradle.api.Generated
class `OrgPluginGroup`(internal val plugins: PluginDependenciesSpec)


/**
 * Plugin ids starting with `org`.
 */
val `PluginDependenciesSpec`.`org`: `OrgPluginGroup`
    get() = `OrgPluginGroup`(this)


/**
 * The `org.gradle` plugin group.
 */
@org.gradle.api.Generated
class `OrgGradlePluginGroup`(internal val plugins: PluginDependenciesSpec)


/**
 * Plugin ids starting with `org.gradle`.
 */
val `OrgPluginGroup`.`gradle`: `OrgGradlePluginGroup`
    get() = `OrgGradlePluginGroup`(plugins)


/**
 * The `org.gradle.toolchains` plugin group.
 */
@org.gradle.api.Generated
class `OrgGradleToolchainsPluginGroup`(internal val plugins: PluginDependenciesSpec)


/**
 * Plugin ids starting with `org.gradle.toolchains`.
 */
val `OrgGradlePluginGroup`.`toolchains`: `OrgGradleToolchainsPluginGroup`
    get() = `OrgGradleToolchainsPluginGroup`(plugins)


/**
 * The `org.gradle.toolchains.foojay-resolver` plugin implemented by [org.gradle.toolchains.foojay.FoojayToolchainsPlugin].
 */
val `OrgGradleToolchainsPluginGroup`.`foojay-resolver`: PluginDependencySpec
    get() = plugins.id("org.gradle.toolchains.foojay-resolver")


/**
 * The `org.gradle.toolchains.foojay-resolver-convention` plugin implemented by [org.gradle.toolchains.foojay.FoojayToolchainsConventionPlugin].
 */
val `OrgGradleToolchainsPluginGroup`.`foojay-resolver-convention`: PluginDependencySpec
    get() = plugins.id("org.gradle.toolchains.foojay-resolver-convention")
