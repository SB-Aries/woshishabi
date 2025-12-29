#!/usr/bin/env python3

# HTML Report Generator Module for Wapiti Project
# Wapiti Project (https://wapiti-scanner.github.io)
#
# Copyright (C) 2017-2023 Nicolas SURRIBAS
# Copyright (C) 2020-2024 Cyberwatch
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

import os
from mako.template import Template
from wapitiCore.report.reportgenerator import ReportGenerator
import wapitiCore

def level_to_css_class(level):
    """Convert vulnerability level to CSS class for styling"""
    if level == 0:
        return "severity-info"
    elif level == 1:
        return "severity-low"
    elif level == 2:
        return "severity-medium"
    elif level >= 3:
        return "severity-high"
    return "severity-info"


class HTMLReportGenerator(ReportGenerator):
    """This class generates HTML reports from Wapiti scan results."""

    def __init__(self):
        super().__init__()
        # Flaw categories (vulnerabilities, anomalies, additionals)
        self._flaw_types = {}

        # Flaw instances
        self._vulns = {}
        self._anomalies = {}
        self._additionals = {}

        self._final__path = ""

    def add_vulnerability(
        self,
        module: str,
        category=None,
        level=0,
        request=None,
        parameter="",
        info="",
        wstg: str = None,
        response=None
    ):
        """
        Store the information about a found vulnerability in the format expected by the HTML template.
        """
        from wapitiCore.net.web import http_repr, curl_repr
        from wapitiCore.net.response import detail_response

        vuln_dict = {
            "method": request.method if request else "",
            "path": request.file_path if request else "",
            "info": info,
            "level": level,
            "parameter": parameter,
            "referer": request.referer if request else "",
            "module": module,
            "http_request": http_repr(request, left_margin="") if request else "",
            "curl_command": curl_repr(request) if request else "",
            "wstg": wstg,
        }
        if self._infos["detailed_report_level"] >= 1:
            vuln_dict["detail"] = {
                "response": detail_response(response)
            }
        if category not in self._vulns:
            self._vulns[category] = []
        self._vulns[category].append(vuln_dict)

    def add_anomaly(
        self,
        module: str,
        category=None,
        level=0,
        request=None,
        parameter="",
        info="",
        wstg=None,
        response=None
    ):
        """Store the information about an anomaly met during the attack in the format expected by the HTML template."""
        from wapitiCore.net.web import http_repr, curl_repr
        from wapitiCore.net.response import detail_response

        anom_dict = {
            "method": request.method if request else "",
            "path": request.file_path if request else "",
            "info": info,
            "level": level,
            "parameter": parameter,
            "referer": request.referer if request else "",
            "module": module,
            "http_request": http_repr(request, left_margin="") if request else "",
            "curl_command": curl_repr(request) if request else "",
            "wstg": wstg
        }
        if self._infos["detailed_report_level"] >= 1:
            anom_dict["detail"] = {
                "response": detail_response(response)
            }
        if category not in self._anomalies:
            self._anomalies[category] = []
        self._anomalies[category].append(anom_dict)

    def add_additional(
        self,
        module: str,
        category=None,
        level=0,
        request=None,
        parameter="",
        info="",
        wstg=None,
        response=None
    ):
        """Store the information about an additional in the format expected by the HTML template."""
        from wapitiCore.net.web import http_repr, curl_repr
        from wapitiCore.net.response import detail_response

        addition_dict = {
            "method": request.method if request else "",
            "path": request.file_path if request else "",
            "info": info,
            "level": level,
            "parameter": parameter,
            "referer": request.referer if request else "",
            "module": module,
            "http_request": http_repr(request, left_margin="") if request else "",
            "curl_command": curl_repr(request) if request else "",
            "wstg": wstg
        }

        if self._infos["detailed_report_level"] >= 1:
            addition_dict["detail"] = {
                "response": detail_response(response)
            }

        if category not in self._additionals:
            self._additionals[category] = []
        self._additionals[category].append(addition_dict)

    def generate_report(self, output_path):
        """Generate HTML report from collected data."""
        mytemplate = Template(
            filename=os.path.join(os.path.dirname(__file__), "..", "report_template", "report.html"),
            input_encoding="utf-8",
            output_encoding="utf-8"
        )

        # Extract target name for filename
        if "target" in self._infos:
            report_target_name = self._infos["target"].replace("http://", "").replace("https://", "").replace("/", "")
        else:
            report_target_name = "wapiti_report"

        # Report time (used for timestamping)
        from time import strftime
        report_time = strftime("%Y%m%d_%H%M%S")

        filename = f"{report_target_name}_{report_time}.html"

        # Check if output_path is a directory or a full file path
        if os.path.isdir(output_path):
            # If it's a directory, create the file inside it
            self._final__path = os.path.join(output_path, filename)
        else:
            # If it's a file path, use it directly
            self._final__path = output_path
            # Ensure the directory exists
            output_dir = os.path.dirname(output_path)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)

        with open(self._final__path, "w", encoding='utf-8') as html_report_file:
            html_report_file.write(
                mytemplate.render_unicode(
                    target=self._infos["target"],
                    scan_date=self._infos["date"],
                    scan_scope=self._infos["scope"],
                    auth_dict=self._infos["auth"],
                    auth_form_dict=self._infos["auth"].get("form") if self._infos.get("auth") is not None else {},
                    crawled_pages_nbr=self._infos["crawled_pages_nbr"],
                    vulnerabilities=self._vulns,
                    anomalies=self._anomalies,
                    additionals=self._additionals,
                    flaws=self._flaw_types,
                    level_to_css_class=level_to_css_class,
                    detailed_report_level=self._infos["detailed_report_level"],
                    detailed_report=True,  # Add this to fix the "Undefined" error
                    wapiti_version=wapitiCore.WAPITI_VERSION,
                    Aries_version=wapitiCore.WAPITI_VERSION  # Add missing Aries_version variable
                )
            )

    @property
    def final_path(self):
        return self._final__path